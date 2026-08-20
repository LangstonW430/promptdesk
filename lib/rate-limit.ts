/**
 * A ceiling on how often one caller can do something expensive.
 *
 * Nothing in the app had one. That left password sign-in open to credential
 * stuffing at whatever rate an attacker cares to send, `/api/prompts/generate`
 * — retrieval, scoring and budgeting under a 30-second function timeout —
 * open as a way to spend the deployment's compute budget, and the per-user
 * webhook path open to being walked for valid tokens.
 *
 * ── What this is not ─────────────────────────────────────────────────────────
 *
 * The counters live in the process. On a serverless deployment each instance
 * keeps its own, so the effective limit is the configured one times however
 * many instances are warm, and an instance that gets recycled forgets
 * everything it had counted. That makes this a real obstacle to a single
 * attacker hammering an endpoint and *not* a guarantee about a distributed
 * one.
 *
 * It is here because the alternative on the table was nothing at all, and
 * because the shape it imposes on the call sites is the part worth having: a
 * shared store swaps in behind `rateLimit()` without touching them. Anything
 * relying on a hard global limit — billing, quota enforcement — wants Redis or
 * Postgres, not this.
 */

type Window = { count: number; resetAt: number }

/**
 * Bucketed so two limits on the same identifier cannot collide: a user id is
 * the key for prompt generation and could be the key for something else later.
 */
const windows = new Map<string, Window>()

/**
 * Beyond this many tracked keys, the oldest are dropped.
 *
 * The keys are partly attacker-chosen — an IP, an email address — so an
 * unbounded map is itself a way to exhaust memory. Dropping an entry only ever
 * forgives a caller, which is the safe direction to fail when the alternative
 * is the process running out of heap.
 */
const MAX_TRACKED_KEYS = 20_000

export interface RateLimitOptions {
  /** How many requests are allowed inside one window. */
  limit: number
  /** Window length in milliseconds. */
  windowMs: number
}

export type RateLimitResult =
  | { ok: true; remaining: number }
  | { ok: false; retryAfterSeconds: number }

function prune(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key)
  }
  if (windows.size <= MAX_TRACKED_KEYS) return
  // Still oversized after dropping the expired ones: shed the oldest by reset
  // time until back under the cap.
  const byAge = [...windows.entries()].sort((a, b) => a[1].resetAt - b[1].resetAt)
  for (const [key] of byAge.slice(0, windows.size - MAX_TRACKED_KEYS)) {
    windows.delete(key)
  }
}

/**
 * Records one attempt and says whether it is allowed.
 *
 * Fixed window: the first call starts a window, and the counter resets when it
 * expires. A caller can therefore burst across a window boundary at up to twice
 * the limit, which is fine for everything here — these are guards against
 * sustained abuse, not precise quotas.
 */
export function rateLimit(
  bucket: string,
  key: string,
  { limit, windowMs }: RateLimitOptions,
): RateLimitResult {
  const now = Date.now()

  // Amortised cleanup — cheap, and avoids needing a timer that would keep a
  // serverless instance alive.
  if (windows.size > 128) prune(now)

  const id = `${bucket}:${key}`
  const existing = windows.get(id)

  if (!existing || existing.resetAt <= now) {
    windows.set(id, { count: 1, resetAt: now + windowMs })
    return { ok: true, remaining: limit - 1 }
  }

  if (existing.count >= limit) {
    return {
      ok: false,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    }
  }

  existing.count += 1
  return { ok: true, remaining: limit - existing.count }
}

/** Drops all counters. Tests only — nothing in the app should need this. */
export function resetRateLimits(): void {
  windows.clear()
}

/**
 * The client address, as well as it can be known behind a proxy.
 *
 * `x-forwarded-for` is a client-settable header that the platform rewrites;
 * only the *first* entry is the original client, and only because Vercel
 * replaces the header rather than appending to it. Taking the last entry, or
 * trusting it on a deployment that appends, would let a caller pick their own
 * rate-limit key by sending the header themselves.
 *
 * Returns a fixed string when there is no address to read, so callers share one
 * bucket rather than each getting a free pass.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  return headers.get('x-real-ip')?.trim() || 'unknown'
}
