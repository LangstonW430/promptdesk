/**
 * Where a `?next=` parameter is allowed to send someone.
 *
 * Both places that honour one — the OAuth callback and the sign-in action —
 * were building a destination out of a string taken straight off the query.
 * Two distinct ways that went wrong:
 *
 *   1. The callback concatenated it onto the origin with no check at all.
 *      `origin` carries no trailing slash, so `?next=@evil.com` produced
 *      `https://app.example.com@evil.com` — everything before the `@` is
 *      userinfo, and the browser goes to evil.com. `?next=.evil.com` is worse
 *      to read: `https://app.example.com.evil.com` looks like a subdomain and
 *      is a different registrable domain.
 *
 *   2. The sign-in action checked `startsWith('/')`, which `//evil.com`
 *      satisfies. A protocol-relative URL keeps the current scheme and
 *      replaces the host, so that is the same redirect wearing a `/`.
 *
 * Both land the user off-site at the moment they have just proved who they
 * are, which is exactly when a login page asking them to "try again" is
 * believable. So the rule here is not "reject the known bad shapes" — that is
 * the game already lost twice above — it is: a destination has to parse as a
 * path on our own origin, or it is not used.
 */

/** Where an absent or rejected `next` goes instead. */
const FALLBACK = '/dashboard'

/**
 * Control characters, which never appear in a legitimate path.
 *
 * Checked before parsing, because the URL parser strips tabs, newlines and
 * carriage returns silently rather than rejecting them. Without this the
 * string that was validated and the string that came back could disagree, and
 * a newline is what splits a Location header in the first place.
 */
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

/**
 * Normalises an untrusted `next` value to a same-origin path.
 *
 * Returns a string that always begins with a single `/` and never carries a
 * scheme, host or userinfo — safe to append to an origin or hand to
 * `redirect()`. Anything that cannot be read as such a path becomes `fallback`.
 */
export function safeNextPath(next: unknown, fallback: string = FALLBACK): string {
  if (typeof next !== 'string' || next === '') return fallback

  if (CONTROL_CHARS.test(next)) return fallback

  // Must be an absolute path, and must not be protocol-relative. A backslash is
  // rejected in the same breath: browsers normalise `/\` to `//` in the
  // authority position, so `/\evil.com` is `//evil.com` written differently.
  if (!next.startsWith('/')) return fallback
  if (next.startsWith('//') || next.startsWith('/\\')) return fallback

  // Resolve against a throwaway origin and keep only the parts of the result
  // that belong to a path. Anything that managed to set a host is discarded by
  // construction rather than by one more pattern match.
  let url: URL
  try {
    url = new URL(next, 'https://safe-redirect.invalid')
  } catch {
    return fallback
  }
  if (url.origin !== 'https://safe-redirect.invalid') return fallback

  return `${url.pathname}${url.search}${url.hash}`
}
