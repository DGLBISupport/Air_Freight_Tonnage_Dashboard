-- Run once before deploying the matching frontend/backend. Do not rename or
-- delete public.users: NPS still owns references to that table.
BEGIN;

-- Explicit columns prevent copying NPS fields, foreign keys, triggers or policies.
-- Intentionally no IF NOT EXISTS: re-running must not restore deleted recipients.
CREATE TABLE public.tonnage_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email text NOT NULL UNIQUE,
    display_name text,
    station text NOT NULL DEFAULT 'Global',
    is_air boolean NOT NULL DEFAULT true,
    is_sea boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Preserve the users currently visible in Tonnage, including schedule creator IDs.
-- This is a one-time copy; subsequent edits/deletes are independent in each app.
INSERT INTO public.tonnage_users
    (id, email, display_name, station, is_air, is_sea, created_at)
SELECT id, email, display_name, COALESCE(station, 'Global'),
       COALESCE(is_air, true), COALESCE(is_sea, false), COALESCE(created_at, now())
FROM public.users;

ALTER TABLE public.tonnage_users ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tonnage_users FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tonnage_users TO authenticated;
GRANT ALL ON public.tonnage_users TO service_role;

CREATE POLICY tonnage_users_admin_access ON public.tonnage_users
    FOR ALL TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.allowed_admins AS admin
            WHERE lower(admin.email) = lower(auth.jwt() ->> 'email')
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.allowed_admins AS admin
            WHERE lower(admin.email) = lower(auth.jwt() ->> 'email')
        )
    );

-- Move only Tonnage's schedule creator relationship. Keep schedule history when
-- a Tonnage user is removed, and leave every NPS constraint untouched.
DO $$
DECLARE
    creator_column smallint;
    fk record;
BEGIN
    IF to_regclass('public.report_schedules') IS NOT NULL THEN
        SELECT attnum INTO creator_column
        FROM pg_attribute
        WHERE attrelid = 'public.report_schedules'::regclass
          AND attname = 'created_by' AND NOT attisdropped;

        IF creator_column IS NOT NULL THEN
            FOR fk IN
                SELECT conname, confrelid
                FROM pg_constraint
                WHERE conrelid = 'public.report_schedules'::regclass
                  AND contype = 'f' AND conkey = ARRAY[creator_column]
            LOOP
                IF fk.confrelid <> 'public.users'::regclass THEN
                    RAISE EXCEPTION 'Unexpected schedule creator relationship: %. Inspect before migrating.', fk.conname;
                END IF;
                EXECUTE format('ALTER TABLE public.report_schedules DROP CONSTRAINT %I', fk.conname);
            END LOOP;

            ALTER TABLE public.report_schedules ALTER COLUMN created_by DROP NOT NULL;
            ALTER TABLE public.report_schedules
                ADD CONSTRAINT report_schedules_tonnage_created_by_fkey
                FOREIGN KEY (created_by) REFERENCES public.tonnage_users(id)
                ON DELETE SET NULL;
        END IF;
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
COMMIT;
