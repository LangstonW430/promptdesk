import { accessTokenFor } from './auth-server'

/**
 * A signed-in browser, expressed as a Cookie header.
 *
 * `@supabase/ssr` keeps the session in a cookie named after the Supabase
 * project, holding the session JSON base64url-encoded behind a `base64-`
 * prefix. Building that cookie by hand — rather than calling
 * `signInWithPassword` against a stub — keeps the fake confined to the Auth
 * server: the app still parses the cookie, validates the session and calls
 * getUser() with the token inside it, all through the real @supabase/ssr code.
 */

/**
 * The cookie name for a Supabase URL.
 *
 * supabase-js derives it as `sb-<first label of the hostname>-auth-token`,
 * which for https://abcdefg.supabase.co is the project ref, and for
 * http://127.0.0.1:54321 is "127". Deriving it the same way rather than
 * hardcoding means the harness follows the app if the URL changes.
 */
export function sessionCookieName(supabaseUrl: string): string {
  const { hostname } = new URL(supabaseUrl)
  return `sb-${hostname.split('.')[0]}-auth-token`
}

type SessionOptions = {
  /** Seconds from now until the access token expires. Negative for an expired one. */
  expiresIn?: number
}

/** The session object as @supabase/ssr stores it. */
function session(userId: string, email: string, { expiresIn = 3600 }: SessionOptions) {
  return {
    access_token: accessTokenFor(userId),
    refresh_token: `e2e-refresh-token.${userId}`,
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: Math.floor(Date.now() / 1000) + expiresIn,
    user: {
      id: userId,
      aud: 'authenticated',
      role: 'authenticated',
      email,
    },
  }
}

/**
 * A Cookie header value that signs requests in as this user.
 *
 * The value is kept short on purpose: @supabase/ssr splits anything over 3180
 * characters across numbered cookies, and a session this size never gets
 * close, so the harness does not have to reimplement the chunking.
 */
export function sessionCookie(
  supabaseUrl: string,
  userId: string,
  email: string,
  options: SessionOptions = {},
): string {
  const encoded = Buffer.from(JSON.stringify(session(userId, email, options)), 'utf8').toString(
    'base64url',
  )
  return `${sessionCookieName(supabaseUrl)}=base64-${encoded}`
}
