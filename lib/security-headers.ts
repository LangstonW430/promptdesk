/**
 * The response headers that constrain what a page is allowed to do.
 *
 * Nothing was setting any of these, which left two gaps worth naming. Every
 * authenticated page was framable, so a transparent iframe over a "Delete
 * client" or "Void invoice" button was a working clickjack. And there was no
 * CSP, so an injected script — from a dependency, a stored field that finds a
 * sink later, anything — ran with the same reach as our own code.
 *
 * The CSP is nonce-based rather than `'unsafe-inline'`. Nonces normally cost
 * static rendering, which is why they are often skipped, but nothing here is
 * statically rendered anyway: every page under (app) reads the session, and the
 * public invoice page is already `force-dynamic`. So the strict version is
 * close to free.
 */

/** Hosts the browser is allowed to talk to, beyond our own origin. */
function connectSources(): string[] {
  const sources = new Set<string>()

  // The Supabase browser client calls Auth, PostgREST and Storage directly.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (supabaseUrl) {
    try {
      const { origin, host } = new URL(supabaseUrl)
      sources.add(origin)
      // Realtime rides a websocket on the same host.
      sources.add(`wss://${host}`)
    } catch {
      // A malformed URL is lib/env.ts's problem to report, not ours to crash on.
    }
  }

  // Sentry ingest, when a DSN is configured. Errors and replays are POSTed to
  // the project's ingest host, which is not our origin.
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN
  if (dsn) {
    try {
      sources.add(new URL(dsn).origin)
    } catch {
      // Same as above — an unusable DSN disables Sentry, it does not break CSP.
    }
  }

  return [...sources]
}

/**
 * Builds the Content-Security-Policy for one request.
 *
 * `strict-dynamic` is what makes a nonce workable in Next: the framework loads
 * its chunks from a bootstrap script rather than from tags in the HTML, so
 * allow-listing paths would not cover them. Trust propagates from the nonced
 * bootstrap to what it loads instead. `'self'` stays for browsers that do not
 * implement strict-dynamic, which ignore the nonce and fall back to it.
 *
 * `'unsafe-inline'` survives only in `style-src`. React writes style attributes
 * and Next inlines a stylesheet during development; the exposure from injected
 * CSS is a different order of magnitude from injected script, and removing it
 * would mean a nonce on every style attribute in the tree.
 */
export function buildCsp(nonce: string, isDev: boolean): string {
  const directives: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      // Webpack/Turbopack HMR and React Refresh compile with eval in dev.
      // Never in a production response.
      ...(isDev ? ["'unsafe-eval'"] : []),
    ],
    'style-src': ["'self'", "'unsafe-inline'"],
    // next/font self-hosts at build time, so there is no font CDN to allow.
    'font-src': ["'self'", 'data:'],
    'img-src': ["'self'", 'data:', 'blob:'],
    'connect-src': ["'self'", ...connectSources(), ...(isDev ? ['ws:'] : [])],
    // Attachment downloads are 302s to Supabase Storage signed URLs, which the
    // browser navigates to rather than embeds.
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    'object-src': ["'none'"],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
  }

  const policy = Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(' ')}`)
    .join('; ')

  // Pointless over http, and http is what local development serves.
  return isDev ? policy : `${policy}; upgrade-insecure-requests`
}

/**
 * Headers that do not vary per request.
 *
 * Applied from next.config.ts rather than here so they cover every response,
 * including the static assets the proxy's matcher deliberately skips.
 */
export const STATIC_SECURITY_HEADERS: { key: string; value: string }[] = [
  // Belt-and-braces with frame-ancestors, for anything that predates CSP3.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Stops a text/plain upload being sniffed into something executable.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Invoice and client URLs carry unguessable tokens and record ids; do not
  // hand them to whatever a user clicks through to.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Nothing here uses any of these.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]
