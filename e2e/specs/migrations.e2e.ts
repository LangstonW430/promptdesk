import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { randomUUID } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { databaseUrl, db } from '../harness/context'
import { migrationNames } from '../harness/database'

const run = promisify(execFile)
const PRISMA = path.join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js')

/**
 * The one difference that is allowed to stand.
 *
 * `clients.search_vector` is `Unsupported("tsvector")`, and its GIN index is
 * created as raw SQL in 20260601000000_init because the Prisma schema language
 * cannot describe an index over a type it does not model. Prisma therefore
 * reports it as an extra index on every diff. Dropping it to satisfy the
 * comparison would delete the index that makes client search work.
 *
 * Nothing else belongs in this list. Each entry is a place where the database
 * and schema.prisma are knowingly allowed to differ, so a new one needs the
 * same kind of justification.
 */
const EXPECTED_DIFFERENCES = [/^DROP INDEX "clients_search_vector_gin_idx";$/]

/**
 * The SQL Prisma would have to run to turn the migrated database into
 * schema.prisma — with the CLI's own chatter and comments removed.
 */
function driftStatements(stdout: string): string[] {
  return stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !line.startsWith('--'))
    // The CLI prints which env file it loaded, on stdout, before the script.
    .filter((line) => /^[A-Z]/.test(line))
    .filter((line) => !EXPECTED_DIFFERENCES.some((allowed) => allowed.test(line)))
}

/**
 * Whether the migration history can build the database.
 *
 * Every other test here depends on it — the harness creates its database by
 * replaying `prisma/migrations` in order, so a broken history fails the whole
 * suite before a single request is made. That is the intent: the reason the
 * `invoices` table could go a year without a migration is that nothing ever
 * built the schema from scratch. Production had been pushed to by hand, and
 * `migrate deploy` against an empty database had been failing since June with
 * "relation invoices does not exist" — but only a fresh database would ever
 * have said so.
 */
describe('the migration history', () => {
  it('replays cleanly from empty', () => {
    // Reaching this test at all means it did: the harness applied every
    // migration before the suite started. Asserted explicitly so the guarantee
    // is visible rather than implied.
    expect(migrationNames().length).toBeGreaterThan(0)
  })

  /**
   * The check that would have caught it at the time.
   *
   * Prisma compares the database the migrations produced against
   * schema.prisma. Any difference means the two have diverged — a table pushed
   * without a migration, a column added to the schema and never migrated, an
   * index that exists in one place only. Empty output is the pass.
   */
  it('produces exactly the schema in schema.prisma', async () => {
    const { stdout } = await run(
      process.execPath,
      [
        PRISMA,
        'migrate',
        'diff',
        '--from-config-datasource',
        '--to-schema',
        'prisma/schema.prisma',
        '--script',
      ],
      {
        cwd: process.cwd(),
        // prisma.config.ts reads DIRECT_URL, and dotenv will not override a
        // variable that is already set — so this points the CLI at the test
        // database rather than at whatever .env.local names.
        //
        // The shadow URL is a placeholder that is never connected to — this
        // diff reads an existing database and a datamodel, neither of which
        // needs one. It has to be set, and set to something other than the
        // main database, because the config validation rejects both the empty
        // string .env.local leaves there and a duplicate of DIRECT_URL.
        env: {
          ...process.env,
          DIRECT_URL: databaseUrl,
          SHADOW_DATABASE_URL: 'postgresql://unused:unused@127.0.0.1:1/unused',
        },
      },
    )

    expect(driftStatements(stdout)).toEqual([])
  }, 120_000)

  /**
   * The trigger every account depends on. Supabase Auth writes to auth.users;
   * nothing in the app does. If this stops firing, a user signs up
   * successfully and then every foreign key pointing at public.users fails.
   */
  it('creates the public user row when Supabase Auth creates the auth one', async () => {
    const id = randomUUID()

    await db.query(
      `INSERT INTO auth.users (id, email, raw_user_meta_data)
       VALUES ($1, $2, '{"full_name":"Grace Reed"}'::jsonb)`,
      [id, 'grace@example.test'],
    )

    const { rows } = await db.query('SELECT id, email, full_name FROM public.users WHERE id = $1', [
      id,
    ])
    expect(rows).toEqual([{ id, email: 'grace@example.test', full_name: 'Grace Reed' }])
  })

  it('leaves no owner-scoped table without row level security', async () => {
    const { rows } = await db.query(`
      SELECT c.relname AS table
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN information_schema.columns col
        ON col.table_schema = 'public'
       AND col.table_name = c.relname
       AND col.column_name = 'owner_id'
      WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relrowsecurity = false
      ORDER BY 1
    `)

    expect(rows.map((r) => r.table)).toEqual([])
  })

  /**
   * RLS is not what protects the API — Prisma connects as the table owner and
   * bypasses it, exactly as it does against the Supabase pooler. It is the
   * second line, for anything reaching the database with a user's own JWT.
   * This checks the policies actually discriminate rather than merely existing.
   */
  it('has policies that filter by the caller once RLS applies to them', async () => {
    const mine = randomUUID()
    const theirs = randomUUID()
    for (const id of [mine, theirs]) {
      await db.query('INSERT INTO auth.users (id, email) VALUES ($1, $2)', [
        id,
        `${id.slice(0, 8)}@example.test`,
      ])
      await db.query('INSERT INTO clients (owner_id, company_name) VALUES ($1, $2)', [
        id,
        `Client of ${id.slice(0, 8)}`,
      ])
    }

    const client = await db.connect()
    try {
      // A role that RLS is not waived for, standing in for the authenticated
      // Supabase role.
      await client.query('CREATE ROLE e2e_rls_probe NOLOGIN')
      await client.query('GRANT SELECT ON clients TO e2e_rls_probe')
      await client.query('BEGIN')
      await client.query(`SELECT set_config('request.jwt.claim.sub', $1, true)`, [mine])
      await client.query('SET LOCAL ROLE e2e_rls_probe')

      const { rows } = await client.query('SELECT owner_id FROM clients')

      expect(rows).toHaveLength(1)
      expect(rows[0].owner_id).toBe(mine)
    } finally {
      await client.query('ROLLBACK')
      await client.query('DROP ROLE IF EXISTS e2e_rls_probe').catch(() => {})
      client.release()
    }
  })
})
