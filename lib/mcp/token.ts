import { createHash, randomBytes } from 'node:crypto'

/**
 * Minting and recognising MCP access tokens. Pure — no I/O, no Prisma.
 *
 * Kept separate from `tokens.ts` (which reads and writes rows) so the format
 * can be tested without a database, and so there is exactly one place that
 * knows what a token looks like.
 */

/**
 * Marks the string as one of ours.
 *
 * Worth the eight characters: a prefixed token is greppable in a log that
 * should never have contained it, recognisable to the secret scanners that
 * watch public repositories, and obvious to a user wondering which of the
 * opaque strings in their config file is which. `pd_` outlives the rename —
 * it is short enough to read as initials rather than a product name.
 */
export const TOKEN_PREFIX = 'pd_live_'

/** Bytes of entropy in the random part. 32 bytes = 256 bits. */
const TOKEN_BYTES = 32

/**
 * How long the random part is once base64url-encoded: 32 bytes unpadded.
 * Pinned so `isWellFormedToken` can reject anything that is not the shape this
 * module mints.
 */
const TOKEN_BODY_CHARS = 43

/**
 * How much of a token the UI may show.
 *
 * The prefix plus six characters: enough to tell two tokens apart in a list,
 * far too little to guess the remaining ~250 bits.
 */
const HINT_CHARS = 6

export interface NewToken {
  /** Shown to the user exactly once and never stored. */
  plaintext: string
  /** sha-256 hex. This is what gets persisted. */
  hash: string
  /** The non-secret leading characters, for display. */
  hint: string
}

/**
 * A fresh token.
 *
 * base64url rather than hex so the string stays short enough to paste
 * comfortably, and URL-safe so it survives being put in a header, a shell
 * command or a JSON config without escaping.
 */
export function generateToken(): NewToken {
  const plaintext = TOKEN_PREFIX + randomBytes(TOKEN_BYTES).toString('base64url')
  return {
    plaintext,
    hash: hashToken(plaintext),
    hint: plaintext.slice(0, TOKEN_PREFIX.length + HINT_CHARS),
  }
}

/**
 * The stored form of a token.
 *
 * sha-256, unsalted and deliberately so: the hash is the lookup key, and a
 * salt that varied per row could not be applied before the row was found.
 * That trade is only acceptable because the input is `randomBytes(32)` rather
 * than something a person chose — there is no dictionary to run and no
 * precomputed table that could hold 256 bits of noise. A single fast hash is
 * the right primitive here for the same reason it would be the wrong one for
 * a password.
 */
export function hashToken(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex')
}

/**
 * Whether a string is shaped like a token this module would have minted.
 *
 * Checked before hashing, which is the point: without it, a caller could make
 * the server SHA-256 a megabyte of header and then run a database lookup for
 * it, once per request. A cheap regex in front turns that into a rejection
 * that costs nothing. It is not a security check — a well-formed token that
 * was never issued still fails at the lookup — it is a cost check.
 */
export function isWellFormedToken(token: string): boolean {
  return new RegExp(
    `^${TOKEN_PREFIX}[A-Za-z0-9_-]{${TOKEN_BODY_CHARS}}$`,
  ).test(token)
}

/**
 * The token out of an `Authorization: Bearer <token>` header, or null.
 *
 * The scheme match is case-insensitive because RFC 7235 says it is, and a
 * client that sends `bearer` is not wrong. Anything else — a missing header,
 * `Basic`, a bare token with no scheme — is null rather than an exception:
 * the caller turns it into the same 401 as a token that simply does not
 * exist, and the distinction is not something an unauthenticated caller
 * should be able to learn.
 */
export function parseBearer(header: string | null | undefined): string | null {
  // Bounded before the regex runs: a pathological header should not become a
  // backtracking problem or a large allocation. Any real token is 51 chars.
  if (!header || header.length > MAX_HEADER_CHARS) return null
  const match = /^Bearer[ ]+(\S+)$/i.exec(header.trim())
  return match ? match[1] : null
}

/** Generous next to a 51-character token, mean next to an abusive header. */
const MAX_HEADER_CHARS = 256
