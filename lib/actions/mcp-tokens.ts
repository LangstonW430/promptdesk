'use server'

import { revalidatePath } from 'next/cache'
import { getOwnerId } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import {
  createMcpToken,
  createMcpTokenSchema,
  revokeMcpToken,
  type McpTokenSummary,
} from '@/lib/mcp/tokens'

/**
 * Return types are written out rather than inferred.
 *
 * Inference turns two object literals into a union with the missing keys
 * added as `?: undefined` on each side, which stops both `'error' in result`
 * and a truthiness check from discriminating — the caller ends up with
 * `string | undefined` where it should have a `string`. Naming the union
 * fixes the call sites and, more usefully, states the contract of an endpoint
 * that is reachable over the wire.
 */
export type CreateMcpTokenResult =
  | { error: string }
  | { error?: undefined; token: McpTokenSummary; plaintext: string }

export type RevokeMcpTokenResult =
  | { error: string }
  | { error?: undefined; token: McpTokenSummary }

/**
 * How many live tokens one account may hold.
 *
 * The list is user-controlled storage, so it needs a ceiling. Ten is well past
 * what anyone needs (a laptop, a desktop, a CI job) and low enough that the
 * settings list stays readable. Revoked tokens do not count — they are kept as
 * a record, and refusing to issue a new one because of old revoked rows would
 * punish the user for having rotated properly.
 */
const MAX_ACTIVE_TOKENS = 10

/**
 * Issues a token and returns the plaintext.
 *
 * This is the only time the plaintext exists outside the client's config file:
 * only its sha-256 is stored, so it cannot be shown again or recovered. The
 * caller must render it from this return value and hold it in local state —
 * `revalidatePath` below refreshes the list, and a component that read the
 * token from that refreshed list would show nothing.
 */
export async function createMcpTokenAction(
  data: unknown,
): Promise<CreateMcpTokenResult> {
  const ownerId = await getOwnerId()
  const parsed = createMcpTokenSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const active = await prisma.mcpToken.count({ where: { ownerId, revokedAt: null } })
  if (active >= MAX_ACTIVE_TOKENS) {
    return {
      error: `You already have ${MAX_ACTIVE_TOKENS} active tokens. Revoke one first.`,
    }
  }

  try {
    const { token, plaintext } = await createMcpToken(ownerId, parsed.data)
    revalidatePath('/settings')
    return { token, plaintext }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to create token',
    }
  }
}

export async function revokeMcpTokenAction(
  id: string,
): Promise<RevokeMcpTokenResult> {
  const ownerId = await getOwnerId()

  const token = await revokeMcpToken(ownerId, id)
  if (!token) return { error: 'Not found' }

  revalidatePath('/settings')
  return { token }
}
