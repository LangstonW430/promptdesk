import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { Pool } from 'pg'
import { freePort } from './ports'

/**
 * A stand-in for the Supabase Auth (GoTrue) server.
 *
 * `getOwnerId()` and the proxy both call `supabase.auth.getUser()`, which is
 * not a local JWT decode — it is an HTTP request to the Auth server, which is
 * the whole reason it can be trusted on the server side. So to test the app's
 * auth for real, something has to answer that request. This does.
 *
 * It is deliberately not a mock inside the app process. The app runs
 * unmodified, pointed at this URL by NEXT_PUBLIC_SUPABASE_URL, and makes a
 * genuine HTTP call. What is faked is Supabase, not the app: cookie parsing,
 * session validation, the proxy's redirect and every `getOwnerId()` call are
 * the real code paths.
 *
 * Users are read from `auth.users` in the test database rather than held in
 * memory, so seeding a user is all it takes for them to be able to sign in.
 */

/** The bearer token for a user id. Opaque to the app; only this server reads it. */
export function accessTokenFor(userId: string): string {
  return `e2e-access-token.${userId}`
}

function userIdFromToken(token: string | undefined): string | null {
  if (!token?.startsWith('e2e-access-token.')) return null
  return token.slice('e2e-access-token.'.length) || null
}

function json(res: ServerResponse, status: number, body: unknown) {
  const payload = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

/** The user shape GoTrue returns, filled from the row in `auth.users`. */
function toGoTrueUser(row: {
  id: string
  email: string | null
  raw_user_meta_data: unknown
  created_at: Date
}) {
  const createdAt = row.created_at.toISOString()
  return {
    id: row.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: row.email,
    email_confirmed_at: createdAt,
    phone: '',
    confirmed_at: createdAt,
    last_sign_in_at: createdAt,
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: row.raw_user_meta_data ?? {},
    identities: [],
    created_at: createdAt,
    updated_at: createdAt,
    is_anonymous: false,
  }
}

export type AuthServer = {
  url: string
  stop: () => Promise<void>
}

export async function startAuthServer(pool: Pool): Promise<AuthServer> {
  const handle = async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')

    // GET /auth/v1/user — the call behind every getUser().
    if (url.pathname === '/auth/v1/user' && req.method === 'GET') {
      const token = req.headers.authorization?.replace(/^Bearer /i, '')
      const userId = userIdFromToken(token)
      if (!userId) {
        return json(res, 401, {
          code: 401,
          error_code: 'bad_jwt',
          msg: 'invalid claim: missing sub claim',
        })
      }

      const { rows } = await pool.query(
        'SELECT id, email, raw_user_meta_data, created_at FROM auth.users WHERE id = $1',
        [userId],
      )
      if (rows.length === 0) {
        // What Supabase returns for a token whose user has been deleted: the
        // signature is fine, the session is not. The app must treat this as
        // signed out, not as an error.
        return json(res, 403, {
          code: 403,
          error_code: 'user_not_found',
          msg: 'User from sub claim in JWT does not exist',
        })
      }

      return json(res, 200, toGoTrueUser(rows[0]))
    }

    // POST /auth/v1/logout — called by signOut().
    if (url.pathname === '/auth/v1/logout' && req.method === 'POST') {
      res.writeHead(204)
      return res.end()
    }

    // POST /auth/v1/token?grant_type=refresh_token — reached only if a test
    // deliberately hands over an expired session. Refusing it is what makes
    // "expired session" mean "signed out" rather than "silently renewed".
    if (url.pathname === '/auth/v1/token' && req.method === 'POST') {
      return json(res, 400, {
        code: 400,
        error_code: 'refresh_token_not_found',
        msg: 'Invalid Refresh Token: Refresh Token Not Found',
      })
    }

    return json(res, 404, { code: 404, msg: `No stub for ${req.method} ${url.pathname}` })
  }

  const server = createServer((req, res) => {
    handle(req, res).catch((err) => {
      json(res, 500, { code: 500, msg: String(err) })
    })
  })

  const port = await freePort()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })

  return {
    url: `http://127.0.0.1:${port}`,
    stop: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  }
}
