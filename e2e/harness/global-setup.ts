import { Pool } from 'pg'
import type { TestProject } from 'vitest/node'
import { startAppServer } from './app-server'
import { startAuthServer } from './auth-server'
import { startDatabase } from './database'

/**
 * Brings up the whole stack once, before any test file runs.
 *
 * Three processes' worth of moving parts, started in dependency order:
 *
 *   Postgres  ──▶  stub Supabase Auth  ──▶  Next.js dev server
 *   (PGlite)       (reads auth.users)       (real app, real HTTP)
 *
 * The URLs are handed to the tests through Vitest's provide/inject, because
 * every port is assigned at run time. Nothing is shared with the developer's
 * own database or dev server.
 */

declare module 'vitest' {
  interface ProvidedContext {
    appUrl: string
    databaseUrl: string
    supabaseUrl: string
  }
}

export default async function setup(project: TestProject) {
  const database = await startDatabase()

  // The Auth stub answers from auth.users, so it needs its own connection.
  const pool = new Pool({ connectionString: database.url, max: 2 })
  const auth = await startAuthServer(pool)

  const app = await startAppServer({
    databaseUrl: database.url,
    supabaseUrl: auth.url,
    distDir: '.next-e2e',
  })

  project.provide('appUrl', app.url)
  project.provide('databaseUrl', database.url)
  project.provide('supabaseUrl', auth.url)

  return async () => {
    await app.stop()
    await auth.stop()
    await pool.end()
    await database.stop()
  }
}
