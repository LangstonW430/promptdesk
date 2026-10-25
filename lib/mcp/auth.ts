import { after } from 'next/server'
import { prisma } from '@/lib/db/client'
import { rateLimit } from '@/lib/rate-limit'
import { hashToken, isWellFormedToken, parseBearer } from './token'

/**
 * Who is calling the MCP server.
 *
 * ── The seam ─────────────────────────────────────────────────────────────────
 *
 * This is the only function in the MCP code that decides whose data a request
 * may see. Everything downstream receives an `ownerId` and never asks where it
 * came from, which is what makes Phase 2 (OAuth, for claude.ai connectors) an
 * edit to this file rather than to every tool: a verified OAuth token resolves
 * to an owner here, in a second branch, and the tools do not change.
 *
 * ── Why not `getOwnerId()` ───────────────────────────────────────────────────
 *
 * Every other route and page in this app starts with `getOwnerId()` from
 * `lib/auth.ts`, and reaching for it here is the obvious reflex — but it reads
 * the Supabase session cookie, and an MCP client sends a bearer token and no
 * cookies at all. It would throw on every request. The reflex is wrong on this
 * path specifically; please leave this as it is.
 *
 * `proxy.ts` is the matching half of that: `/api/mcp` is listed as a public
 * prefix there precisely because the cookie gate would redirect these requests
 * to /login before they ever arrived. The token is the credential.
 */

export type McpAuthResult =
  | { ok: true; ownerId: string }
  | { ok: false; status: 401 | 429; message: string; retryAfterSeconds?: number }

/**
 * How many MCP requests one token may make per minute.
 *
 * Keyed on the token rather than the account so that one runaway or leaked
 * client cannot spend the whole account's allowance. Looser than
 * `/api/prompts/generate`'s 20/min because listing tools and reading a few
 * clients is one ordinary interaction for an MCP client — the expensive path,
 * prompt generation, still goes through that endpoint's own tighter bucket
 * inside `generatePrompt`'s callers.
 */
const RATE_LIMIT = { limit: 60, windowMs: 60_000 } as const

/**
 * How stale `lastUsedAt` is allowed to get.
 *
 * A chatty client can issue many requests a minute, and writing a row on each
 * one would spend a pooled serverless connection on a column nobody reads in
 * real time. An hour's resolution is plenty for "is this token still in use?",
 * which is the only question it answers.
 */
const LAST_USED_RESOLUTION_MS = 60 * 60 * 1000

/**
 * Resolves the bearer token on a request to the account that owns it.
 *
 * A missing, malformed, unknown or revoked token all produce the same 401 with
 * the same message. That is deliberate: distinguishing them would tell an
 * unauthenticated caller which tokens exist, and there is nothing a legitimate
 * client does differently in response to knowing.
 */
export async function resolveMcpOwner(request: Request): Promise<McpAuthResult> {
  const presented = parseBearer(request.headers.get('authorization'))
  // Shape-checked before hashing so a junk header costs a regex rather than a
  // sha-256 and a round trip. The 401 is the same either way.
  if (!presented || !isWellFormedToken(presented)) {
    return { ok: false, status: 401, message: 'Missing or malformed bearer token.' }
  }

  const tokenHash = hashToken(presented)

  // Rate-limited on the hash before the query, so an invalid token cannot be
  // used to make unbounded database round-trips.
  const limit = rateLimit('mcp', tokenHash, RATE_LIMIT)
  if (!limit.ok) {
    return {
      ok: false,
      status: 429,
      message: 'Too many requests. Try again shortly.',
      retryAfterSeconds: limit.retryAfterSeconds,
    }
  }

  const row = await prisma.mcpToken.findUnique({
    where: { tokenHash },
    select: { id: true, ownerId: true, revokedAt: true, lastUsedAt: true },
  })

  if (!row || row.revokedAt) {
    return { ok: false, status: 401, message: 'Invalid or revoked token.' }
  }

  touchLastUsed(row.id, row.lastUsedAt)

  return { ok: true, ownerId: row.ownerId }
}

/**
 * Records that a token was used, without making the caller wait for it.
 *
 * Scheduled with `after()` rather than left as a floating promise. A bare
 * `void prisma.update(...)` looks equivalent and is not: on a serverless
 * platform the instance can be frozen the moment the response is returned, so
 * the write may simply never land — intermittently, and more often under the
 * load that makes it worth having. `after()` is the supported way to say "run
 * this once the response is sent", and it is covered by the route's
 * `maxDuration`.
 *
 * The failure is swallowed: being unable to update a timestamp is not a reason
 * to have refused a request that was properly authenticated, and by the time
 * this runs the response has already gone.
 */
function touchLastUsed(id: string, lastUsedAt: Date | null): void {
  if (lastUsedAt && Date.now() - lastUsedAt.getTime() < LAST_USED_RESOLUTION_MS) {
    return
  }
  after(async () => {
    try {
      await prisma.mcpToken.update({ where: { id }, data: { lastUsedAt: new Date() } })
    } catch {
      // Bookkeeping only.
    }
  })
}
