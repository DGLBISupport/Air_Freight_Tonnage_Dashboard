/* Real PostgreSQL regression with an isolated in-memory PGlite instance.
 * npm install --prefix outputs/tonnage-db-test --no-save --package-lock=false --ignore-scripts @electric-sql/pglite@0.3.14
 * node tests/tonnage_users_migration.cjs
 */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { PGlite } = require("../outputs/tonnage-db-test/node_modules/@electric-sql/pglite");
const migration = fs.readFileSync(path.join(__dirname, "../supabase/migrations/202610150001_isolate_tonnage_users.sql"), "utf8");
const id = "00000000-0000-4000-8000-000000000001";

async function fixture(db) {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
      $$ SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    CREATE TABLE public.allowed_admins (email text PRIMARY KEY);
    GRANT SELECT ON public.allowed_admins TO authenticated;
    INSERT INTO public.allowed_admins VALUES ('admin@example.test');
    CREATE TABLE public.users (
      id uuid PRIMARY KEY, email text NOT NULL UNIQUE, display_name text,
      station text, is_air boolean, is_sea boolean, created_at timestamptz
    );
    INSERT INTO public.users VALUES
      ('${id}', 'shared@example.test', 'Shared Person', 'IND', true, true, now());
    CREATE TABLE public.campaign_station_heads_nps (
      id integer PRIMARY KEY, user_id uuid NOT NULL,
      CONSTRAINT campaign_station_heads_user_nps_fkey FOREIGN KEY (user_id) REFERENCES public.users(id)
    );
    INSERT INTO public.campaign_station_heads_nps VALUES (1, '${id}');
    CREATE TABLE public.report_schedules (
      id integer PRIMARY KEY, created_by uuid REFERENCES public.users(id)
    );
    INSERT INTO public.report_schedules VALUES (1, '${id}');
  `);
}

async function main() {
  const db = new PGlite();
  try {
    await fixture(db);
    await assert.rejects(db.exec(`DELETE FROM public.users WHERE id = '${id}'`),
      /campaign_station_heads_user_nps_fkey/, "Reproduce the reported NPS constraint error");
    await db.exec(migration);
    assert.equal((await db.query("SELECT * FROM public.tonnage_users")).rows[0].id, id);
    await db.exec("SET ROLE anon");
    await assert.rejects(db.query("SELECT * FROM public.tonnage_users"), /permission denied/);
    await db.exec("RESET ROLE; SET ROLE authenticated");
    await db.query("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify({ email: "other@example.test" })]);
    assert.equal((await db.query("SELECT * FROM public.tonnage_users")).rows.length, 0);
    assert.equal((await db.query("DELETE FROM public.tonnage_users RETURNING id")).rows.length, 0);
    await assert.rejects(db.exec("INSERT INTO public.tonnage_users (email) VALUES ('unauthorized@example.test')"), /row-level security/);
    await db.query("SELECT set_config('request.jwt.claims', $1, false)", [JSON.stringify({ email: "ADMIN@example.test" })]);
    assert.equal((await db.query("SELECT * FROM public.tonnage_users")).rows.length, 1);
    await db.exec(`UPDATE public.tonnage_users SET display_name = 'Tonnage Person', is_sea = false WHERE id = '${id}'`);
    await db.exec("INSERT INTO public.tonnage_users (email) VALUES ('tonnage-only@example.test')");
    await db.exec(`DELETE FROM public.tonnage_users WHERE id = '${id}'`);
    await db.exec("RESET ROLE");
    assert.equal((await db.query("SELECT * FROM public.report_schedules")).rows[0].created_by, null);
    const original = (await db.query("SELECT * FROM public.users")).rows[0];
    assert.equal(original.display_name, "Shared Person");
    assert.equal(original.is_sea, true);
    assert.equal((await db.query("SELECT * FROM public.campaign_station_heads_nps")).rows[0].user_id, id);
    await assert.rejects(db.exec(`DELETE FROM public.users WHERE id = '${id}'`), /campaign_station_heads_user_nps_fkey/);
    await db.exec("SET ROLE service_role");
    assert.equal((await db.query("SELECT * FROM public.tonnage_users")).rows.length, 1);
    await db.exec("RESET ROLE");
    await assert.rejects(db.exec(migration), /already exists/);
    await db.exec("ROLLBACK");
    assert.equal((await db.query("SELECT * FROM public.tonnage_users WHERE id = $1", [id])).rows.length, 0,
      "Re-running the migration must never resurrect deleted Tonnage users");
    console.log("PASS: NPS constraint reproduced; independent Tonnage create/edit/delete; schedule retained; RLS enforced; rerun safe.");
  } finally {
    await db.close();
  }

  const unexpected = new PGlite();
  try {
    await fixture(unexpected);
    await unexpected.exec(`
      CREATE TABLE public.other_users (id uuid PRIMARY KEY);
      INSERT INTO public.other_users VALUES ('${id}');
      ALTER TABLE public.report_schedules DROP CONSTRAINT report_schedules_created_by_fkey;
      ALTER TABLE public.report_schedules ADD FOREIGN KEY (created_by) REFERENCES public.other_users(id);
    `);
    await assert.rejects(unexpected.exec(migration), /Unexpected schedule creator relationship/);
    await unexpected.exec("ROLLBACK");
    assert.equal((await unexpected.query("SELECT to_regclass('public.tonnage_users') AS name")).rows[0].name, null);
    assert.equal((await unexpected.query("SELECT * FROM public.campaign_station_heads_nps")).rows.length, 1);
    console.log("PASS: Unexpected creator relationship rolls back the entire migration.");
  } finally {
    await unexpected.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
