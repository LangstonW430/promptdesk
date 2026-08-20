import { spawn, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { STRIPE_ENCRYPTION_KEY } from './env'
import { freePort } from './ports'

/**
 * The application itself, running as a real Next.js server.
 *
 * It is started the way `npm run dev` starts it, in its own process, with
 * nothing stubbed inside it. The tests reach it over HTTP. Everything between
 * the socket and the database — the proxy's session gate, route handler
 * dispatch, `getOwnerId()`, Zod validation, Prisma — is the shipped code.
 *
 * Dev mode rather than `next build && next start`, for one reason:
 * NEXT_PUBLIC_* values are inlined at compile time, and this harness assigns
 * the Supabase and database ports at run time. A prebuilt server would have
 * yesterday's ports baked into it. Dev compiles inside this process, after the
 * environment is set, so it sees the right ones. The cost is that each route
 * compiles on its first request, which is why the timeouts here are generous.
 */

const NEXT_BIN = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next')

export type AppServer = {
  url: string
  stop: () => Promise<void>
}

export type AppServerOptions = {
  databaseUrl: string
  supabaseUrl: string
  /** Written to .next-e2e so a test run and a real `npm run dev` cannot collide. */
  distDir: string
}

export async function startAppServer({
  databaseUrl,
  supabaseUrl,
  distDir,
}: AppServerOptions): Promise<AppServer> {
  const port = await freePort()
  const url = `http://127.0.0.1:${port}`

  const child = spawn(process.execPath, [NEXT_BIN, 'dev', '--port', String(port)], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      NODE_ENV: 'development',
      E2E_DIST_DIR: distDir,

      // Postgres, and the same URL for migrations — there is no pooler here.
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,

      // Points the app's Supabase client at the stub Auth server. The keys are
      // never verified by it; they only have to satisfy lib/env.ts.
      NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'e2e-publishable-key',
      SUPABASE_SERVICE_ROLE_KEY: 'e2e-service-role-key',

      NEXT_PUBLIC_APP_URL: url,

      // Shared with the tests, which encrypt fixtures the app then decrypts.
      STRIPE_ENCRYPTION_KEY,

      // Nothing should reach Sentry from a test run.
      NEXT_PUBLIC_SENTRY_DSN: '',
      SENTRY_DSN: '',
    },
  })

  const logs: string[] = []
  const record = (chunk: Buffer) => {
    const text = chunk.toString()
    logs.push(text)
    if (process.env.E2E_APP_LOGS) process.stdout.write(text)
  }
  child.stdout?.on('data', record)
  child.stderr?.on('data', record)

  let exited: { code: number | null; signal: NodeJS.Signals | null } | null = null
  child.on('exit', (code, signal) => {
    exited = { code, signal }
  })

  await waitForReady(url, () => exited, () => logs.join(''))

  return { url, stop: () => stopChild(child, () => exited !== null) }
}

/**
 * Poll until the server answers.
 *
 * The landing page, because it is the one route that is public, renders, and
 * needs no session — so a 200 means Next has compiled and is serving, without
 * the answer depending on anything the tests are about to assert. Redirects
 * are not followed, so a gate that redirects cannot be mistaken for readiness.
 */
async function waitForReady(
  url: string,
  exited: () => { code: number | null; signal: NodeJS.Signals | null } | null,
  logs: () => string,
) {
  const deadline = Date.now() + 180_000
  let lastError = 'no response yet'

  while (Date.now() < deadline) {
    const dead = exited()
    if (dead) {
      throw new Error(
        `The app server exited before it was ready (code ${dead.code}, signal ${dead.signal}).\n\n${logs()}`,
      )
    }

    try {
      const res = await fetch(`${url}/`, { redirect: 'manual' })
      if (res.status === 200) return
      lastError = `HTTP ${res.status}`
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`The app server never became ready (last: ${lastError}).\n\n${logs()}`)
}

/**
 * Next spawns workers, so killing the parent is not enough on its own —
 * on Windows the children survive it and keep the port. `taskkill /T` takes
 * the tree; elsewhere the negative pid does, since the child leads its own
 * process group.
 */
function stopChild(child: ChildProcess, hasExited: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    if (hasExited() || child.pid === undefined) return resolve()

    const done = () => resolve()
    child.once('exit', done)

    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
    } else {
      child.kill('SIGTERM')
    }

    // Do not hang the whole suite on a server that will not die.
    setTimeout(() => {
      child.removeListener('exit', done)
      resolve()
    }, 10_000).unref()
  })
}
