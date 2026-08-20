import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { PGlite } from '@electric-sql/pglite'
import { PGLiteSocketServer } from '@electric-sql/pglite-socket'
import { freePort } from './ports'

/**
 * A real Postgres for the tests to run against.
 *
 * PGlite is Postgres itself compiled to WebAssembly, and `pglite-socket` puts
 * it behind a TCP socket speaking the wire protocol — so `pg`, Prisma and the
 * Prisma CLI all connect to a `postgresql://` URL and cannot tell the
 * difference. That is the point: the app under test is not reconfigured, mocked
 * or adapted for the tests. It reads DATABASE_URL and connects, exactly as it
 * does on Vercel.
 *
 * The alternative was Docker, which is not installed on every machine that
 * needs to run this suite, or a hosted Postgres, which would make the tests
 * need credentials and a network. This needs neither and starts in about a
 * second.
 */

const MIGRATIONS_DIR = path.join(process.cwd(), 'prisma', 'migrations')

/**
 * The parts of a Supabase database that Supabase provides and the migrations
 * depend on, but that no migration in this repo creates.
 *
 * `auth.users` is the real table Supabase Auth writes to on signup, and the
 * `on_auth_user_created` trigger in `20260601000001_rls_and_trigger` fires off
 * it to create the matching `public.users` row. Recreating it here — rather
 * than seeding `public.users` directly — means the tests exercise that trigger
 * rather than assuming it.
 *
 * `auth.uid()` is what every RLS policy is written against. Prisma connects as
 * the owner of these tables and so bypasses RLS, exactly as it does in
 * production against the Supabase pooler; the function exists so the policies
 * can be created at all, and so a test can set the claim and observe RLS
 * working.
 *
 * `_prisma_migrations` is normally created by `prisma migrate deploy`. We apply
 * the migration files ourselves, so it has to exist before
 * `20260604200000_rls_prisma_migrations` enables RLS on it.
 */
const SUPABASE_SHIM = `
CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email              text UNIQUE,
  raw_user_meta_data jsonb DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- Supabase reads the subject out of the request's JWT. Nothing here issues
-- real JWTs, so the claim is read from a session setting that a test can set
-- with set_config('request.jwt.claim.sub', ...).
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

CREATE TABLE IF NOT EXISTS public._prisma_migrations (
  id                  varchar(36) PRIMARY KEY,
  checksum            varchar(64) NOT NULL,
  finished_at         timestamptz,
  migration_name      varchar(255) NOT NULL,
  logs                text,
  rolled_back_at      timestamptz,
  started_at          timestamptz NOT NULL DEFAULT now(),
  applied_steps_count integer NOT NULL DEFAULT 0
);
`

/** Migration directory names, in the order Prisma would apply them. */
export function migrationNames(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name !== 'migration_lock.toml')
    .sort()
}

export type TestDatabase = {
  /** A `postgresql://` URL. Hand this to anything that speaks Postgres. */
  url: string
  stop: () => Promise<void>
}

/**
 * Start Postgres and build the schema by replaying every migration in order.
 *
 * Replaying the migrations rather than pushing `schema.prisma` is deliberate.
 * It means the suite fails if the migration history cannot build the database
 * — which is how the missing `invoices` table was found, having been pushed
 * straight to production in June and never written down.
 */
export async function startDatabase(): Promise<TestDatabase> {
  const db = await PGlite.create()
  await db.exec(SUPABASE_SHIM)

  for (const name of migrationNames()) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, name, 'migration.sql'), 'utf8')
    try {
      await db.exec(sql)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      throw new Error(`Migration ${name} failed: ${detail}`)
    }
  }

  const port = await freePort()
  const server = new PGLiteSocketServer({
    db,
    port,
    host: '127.0.0.1',
    // Defaults to 1, which resets any connection opened while another is live —
    // and the app's pg Pool opens several. Queries are still serialised onto
    // the single PGlite instance; this only allows the connections to coexist.
    maxConnections: 20,
  })
  await server.start()

  return {
    url: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`,
    stop: async () => {
      await server.stop()
      await db.close()
    },
  }
}

/**
 * Every table the app writes to, ordered so that truncating them in sequence
 * would not trip a foreign key. TRUNCATE ... CASCADE makes the order moot, but
 * the list is still explicit: a new table added to the schema and forgotten
 * here would leave rows behind between tests, and a silently shared row is a
 * worse failure than a loud one.
 */
const TABLES = [
  'form_submissions',
  'forms',
  'invoices',
  'time_entries',
  'transactions',
  'stripe_sync_state',
  'generated_prompts',
  'prompt_templates',
  'attachments',
  'client_tags',
  'tags',
  'tasks',
  'activities',
  'notes',
  'projects',
  'clients',
  'users',
]

/** SQL that empties every table, including the auth schema. */
export function resetSql(): string {
  return `TRUNCATE TABLE ${TABLES.map((t) => `public."${t}"`).join(', ')}, auth.users CASCADE;`
}
