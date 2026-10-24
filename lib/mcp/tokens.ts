import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { generateToken } from './token'

/**
 * Reading and writing MCP token rows, owner-scoped like every other domain
 * module here: `ownerId` is the first argument and every query filters on it.
 */

export const createMcpTokenSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
})

export type CreateMcpTokenInput = z.infer<typeof createMcpTokenSchema>

/** A token row as the settings UI renders it. Never includes the hash. */
export interface McpTokenSummary {
  id: string
  name: string
  tokenHint: string
  lastUsedAt: string | null
  createdAt: string
  revokedAt: string | null
}

const SUMMARY_SELECT = {
  id: true,
  name: true,
  tokenHint: true,
  lastUsedAt: true,
  createdAt: true,
  revokedAt: true,
} as const

type TokenRow = {
  id: string
  name: string
  tokenHint: string
  lastUsedAt: Date | null
  createdAt: Date
  revokedAt: Date | null
}

function toSummary(row: TokenRow): McpTokenSummary {
  return {
    id: row.id,
    name: row.name,
    tokenHint: row.tokenHint,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString() ?? null,
  }
}

/**
 * Every token this owner has issued, revoked ones included.
 *
 * Revoked tokens stay in the list rather than disappearing: the point of
 * revoking one is usually that it leaked, and a row that vanishes takes with
 * it the record of when it was last used — which is the one piece of evidence
 * about whether anyone got to it first.
 */
export async function listMcpTokens(ownerId: string): Promise<McpTokenSummary[]> {
  const rows = await prisma.mcpToken.findMany({
    where: { ownerId },
    select: SUMMARY_SELECT,
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(toSummary)
}

/**
 * Mints a token and returns the plaintext **once**.
 *
 * The plaintext is not stored and cannot be recovered, so this return value is
 * the only chance the user gets to copy it. The caller is responsible for
 * showing it and for not logging it.
 */
export async function createMcpToken(
  ownerId: string,
  input: CreateMcpTokenInput,
): Promise<{ token: McpTokenSummary; plaintext: string }> {
  const { plaintext, hash, hint } = generateToken()

  const row = await prisma.mcpToken.create({
    data: { ownerId, name: input.name, tokenHash: hash, tokenHint: hint },
    select: SUMMARY_SELECT,
  })

  return { token: toSummary(row), plaintext }
}

/**
 * Turns a token off. Returns the updated row, or null when the id is not this
 * owner's.
 *
 * `updateMany` with the owner in the filter rather than `update` by id: a
 * foreign id then matches nothing and reports a count of zero, instead of
 * throwing a Prisma error that would have to be caught and translated — and
 * instead of succeeding, which `update` by id alone would have done.
 *
 * Revoking twice is a no-op rather than an error. `revokedAt` is only written
 * when it is still null, so the timestamp records the first revocation; a
 * second request finds nothing to update and reports the row unchanged.
 */
export async function revokeMcpToken(
  ownerId: string,
  id: string,
): Promise<McpTokenSummary | null> {
  await prisma.mcpToken.updateMany({
    where: { id, ownerId, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  // Read back rather than trusting the update count: zero rows updated means
  // either "not yours" or "already revoked", and only the first of those is a
  // failure. Still owner-scoped, so a foreign id reads as null either way.
  const row = await prisma.mcpToken.findFirst({
    where: { id, ownerId },
    select: SUMMARY_SELECT,
  })
  return row ? toSummary(row) : null
}
