# Separate Tonnage users from NPS

Tonnage previously edited and deleted `public.users`. NPS tables such as
`campaign_station_heads_nps` reference that table, so deleting a shared user
fails with `campaign_station_heads_user_nps_fkey` (or could affect NPS if a
different relationship allowed cascading deletes).

The application now uses `public.tonnage_users` for recipient lists, user edits,
deletions, freight preferences, station assignments and schedule creator lookups.
There is no runtime fallback to `public.users`.

## Apply before deployment

1. Run `migrations/202610150001_isolate_tonnage_users.sql` once in the Supabase SQL
   Editor as the database owner, or apply it through your Supabase migration flow.
   The transaction creates a dedicated table and copies only the fields currently
   used by Tonnage. Existing user IDs and AIR/SEA selections are preserved.
2. Set `SUPABASE_SERVICE_ROLE_KEY` in the backend and standalone mailer environment.
   It is required for background reads of the protected Tonnage user table. Keep
   `SUPABASE_KEY` as the public anon key: `/api/config` sends it to the browser.
   Never put the service role key in a `NEXT_PUBLIC_*` variable.
3. Deploy the matching backend and frontend together. Sign in with an email in
   `allowed_admins`, then verify adding, editing and deleting a Tonnage recipient.

The migration preserves `public.users` and every NPS table and foreign key. It
only redirects `report_schedules.created_by` to `tonnage_users` with
`ON DELETE SET NULL`, keeping schedule history when its creator is removed.
If the creator currently references a different table, the transaction stops
without applying any changes so that relationship can be inspected.

Authenticated administrators can manage Tonnage users. Anonymous clients cannot
read or edit them; background jobs use the backend service role key. The existing
Tonnage station, branch, recipient and schedule tables retain their names.

This is a one-time copy, not synchronization. A subsequent edit or deletion in
either user table does not change the other. Re-running the SQL intentionally
fails at table creation and rolls back, preventing removed recipients from being
copied back into Tonnage.

## Tables and triggers

| Connection | Purpose |
| --- | --- |
| Supabase `tonnage_users` | Recipient names, emails, station/branch assignments and AIR/SEA preferences; frontend CRUD uses `/rest/v1/tonnage_users`. |
| Supabase `allowed_admins` and Supabase Auth | Verify the signed-in user and administrator email before managing recipients or schedules. |
| Supabase `stations`, `branches` | Station/branch metadata used by directory filters and report scope. |
| Supabase `station_recipients`, `branch_recipients` | Legacy station/branch email lists, still mirrored by administration saves for compatibility; report recipient selection uses `tonnage_users`. |
| Supabase `report_schedules` | Saved recipient emails, timing, active state and report filters. `created_by` references `tonnage_users` after migration. |
| SQL Server `DartBIDW` freight views | Source of AIR/SEA shipment, consol, volume, revenue, cost and profit data. |

The directory talks directly to Supabase; it does not need a separate FastAPI
user-deletion endpoint. `GET/POST /api/schedules` lists/saves schedules,
`POST /api/schedules/{id}/toggle` pauses/resumes one, and
`DELETE /api/schedules/{id}` removes it. Saving or toggling also attempts to
synchronize its Google Cloud Scheduler job; deployment logs report sync failures.

Both **Run Report Now** and Cloud Scheduler call `POST /api/schedules/{id}/run`.
Manual requests require an administrator bearer token. Cloud requests require a
matching configured `SCHEDULER_SECRET_TOKEN` in the `X-Scheduler-Token` header.
An inactive schedule returns `skipped`. An active run reads the saved schedule,
calculates its reporting dates, resolves station/branch metadata, queries the
freight warehouse, generates the PDF and companion Excel ledger, and submits them
through Microsoft Graph. Failures return an error; success means Graph accepted
the send request, not confirmation of inbox delivery. Temporary files are cleaned
up and email activity is logged locally in `logs/email_history.log`.

Schedules send to their saved `report_schedules.recipient_email` list. Editing or
deleting a directory recipient, or changing AIR/SEA preferences, does not rewrite
existing schedules. Update or remove those schedules separately. Directory actions
do not send reports or create database triggers. The migration adds no NPS trigger,
foreign key or synchronization to `tonnage_users`.

Scheduled times use `GCP_SCHEDULER_TIMEZONE` (default `Asia/Colombo`), not UTC.
Cloud automation also requires `GCP_PROJECT_ID` (or metadata autodetection),
`GCP_LOCATION`, `CLOUD_RUN_SERVICE_URL`, scheduler credentials and the shared secret.

## Schedule directory and individual configuration

Active Schedules separates station, branch and global report scopes. Branch scope
recognizes both the current `filters.branch` field and older `filters.branch_code`
records. Station, branch, recipient, frequency and status filters narrow the list;
the All schedules tab includes every scope.

Use **Schedule report** beside a recipient in the directory, or choose **One
person** in Configure New Schedule. Select the recipient, target reports,
frequency/day, send time and PDF report sections. One schedule is saved for each
selected target, with only that person's email. Directory assignment is not
modified. No schedule is created until Save Schedule is clicked.

Providing both custom dates saves `filters.use_fixed_dates=true`; leaving both
blank calculates the reporting period at each run. Invalid/incomplete ranges and
empty target selections cannot be saved in the form. Send times display the
configured scheduler timezone from `/api/config`.

These options use the existing `report_schedules` columns and JSON `filters`
field, including `recipient_mode` for the individual/group label. No additional
table, migration, NPS relationship or automatic directory trigger is introduced.

## Independent station and branch subscriptions

`tonnage_users.station` stores explicit, comma-separated report assignments. `BLR`
subscribes a person to BLR branch reports, without subscribing them to IND station
reports. A person with `IND, BLR` explicitly receives both. Parent station metadata
only organizes branches in the directory; it never expands report memberships.
Removing the last assignment leaves the person unassigned instead of granting
Global membership.

Older relational or environment recipient lists cannot overwrite the selected
station and branch memberships. The standalone mailer also
uses only the Tonnage user list when Supabase is configured: an empty result skips
the report, and a failed lookup skips dispatch. Environment recipients are used only
when Supabase is not configured. Existing schedules keep their saved recipient
snapshots and must be updated separately if they contain obsolete memberships.

## Station/branch classification

The UI cross-checks both metadata tables before displaying main stations. Codes
listed as branches, or carrying a distinct parent station field, are excluded from
the main station list. AMD, BLR, BOM, COK and DEL are confirmed IND branches, including
legacy entries stored only in `stations`. Their existing database details are used
in the IND branch list. No metadata rows are deleted or moved in Supabase.

Run `diagnostics/station_branch_classification.sql` in Supabase SQL Editor for a
read-only view of codes present in each table, overlapping entries and stored
parent fields. A successful query result is required to confirm the live data;
local classification tests cannot establish what is currently stored in Supabase.
