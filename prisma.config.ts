import dotenv from 'dotenv'
import { defineConfig } from 'prisma/config'

// Load .env.local so Prisma CLI tools (migrate, studio, generate) find the DB vars.
// On Vercel/CI, these vars are injected by the platform — dotenv silently no-ops.
dotenv.config({ path: '.env.local' })

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  // DIRECT_URL is the non-pooled Supabase connection — required for migrations
  // because pgbouncer (transaction pooler) doesn't support the DDL transactions
  // that Prisma migrations use.
  datasource: {
    url: process.env.DIRECT_URL,
    // shadowDatabaseUrl is used by `prisma migrate dev` to validate migrations
    // without touching your real database. Set this to a second Supabase project
    // (or any plain Postgres URL) if you want to use migrate dev instead of
    // migrate deploy. Omitting it means you must use `npx prisma migrate deploy`
    // when migrations reference Supabase-managed schemas (e.g. auth.users).
    shadowDatabaseUrl: process.env.SHADOW_DATABASE_URL,
  },
})
