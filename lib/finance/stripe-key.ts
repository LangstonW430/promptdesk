/**
 * Per-user Stripe key storage.
 *
 * Keys are encrypted with AES-256-GCM before being written to the database.
 * The encryption key is a deployment-level secret (STRIPE_ENCRYPTION_KEY) — a
 * 64-character hex string representing 32 bytes. Generate it once per deployment:
 *
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Ciphertext format stored in users.stripe_key:
 *   base64(iv) : base64(authTag) : base64(ciphertext)
 *
 * Only the last-4 chars of the raw key are stored in users.stripe_key_hint for
 * display purposes. They reveal nothing useful about the key.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import Stripe from 'stripe'
import { prisma } from '@/lib/db/client'

const ALGORITHM = 'aes-256-gcm' as const
const API_VERSION = '2026-05-27.dahlia' as const

// ─── Encryption helpers ───────────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  const hex = process.env.STRIPE_ENCRYPTION_KEY
  if (!hex) {
    throw new Error(
      'STRIPE_ENCRYPTION_KEY is not set. Generate one with: ' +
        "node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\"",
    )
  }
  if (hex.length !== 64) {
    throw new Error('STRIPE_ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes).')
  }
  return Buffer.from(hex, 'hex')
}

export function encryptKey(plaintext: string): string {
  const key = getEncryptionKey()
  const iv = randomBytes(12)  // 96-bit IV — recommended for GCM
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(':')
}

export function decryptKey(ciphertext: string): string {
  const key = getEncryptionKey()
  const parts = ciphertext.split(':')
  if (parts.length !== 3) throw new Error('Invalid ciphertext format')
  const [ivB64, authTagB64, encB64] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')
  const encrypted = Buffer.from(encB64, 'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

// ─── DB helpers ───────────────────────────────────────────────────────────────

export async function getDecryptedStripeKey(ownerId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { stripeKey: true },
  })
  if (!user?.stripeKey) return null
  return decryptKey(user.stripeKey)
}

export async function saveStripeKey(
  ownerId: string,
  rawKey: string,
  email: string,
): Promise<void> {
  const encrypted = encryptKey(rawKey)
  const hint = rawKey.slice(-4)  // last-4 chars — not sensitive, used for display only
  // upsert so this works even if the public.users row was never created by the
  // Supabase Auth trigger (e.g. accounts that predate the trigger setup).
  await prisma.user.upsert({
    where: { id: ownerId },
    create: { id: ownerId, email, stripeKey: encrypted, stripeKeyHint: hint },
    update: { stripeKey: encrypted, stripeKeyHint: hint },
  })
}

export async function deleteStripeKey(ownerId: string): Promise<void> {
  await prisma.user.update({
    where: { id: ownerId },
    data: { stripeKey: null, stripeKeyHint: null },
  })
}

export async function getStripeKeyStatus(
  ownerId: string,
): Promise<{ connected: boolean; hint: string | null }> {
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { stripeKey: true, stripeKeyHint: true },
  })
  return {
    connected: !!user?.stripeKey,
    hint: user?.stripeKeyHint ?? null,
  }
}

// ─── Key validation ───────────────────────────────────────────────────────────

/**
 * Validates a raw key by making a lightweight Stripe API call.
 * Returns { valid: true } or { valid: false, error: string }.
 */
export async function validateStripeKey(
  rawKey: string,
): Promise<{ valid: true } | { valid: false; error: string }> {
  if (!rawKey.startsWith('rk_')) {
    return {
      valid: false,
      error: 'Must be a restricted key starting with rk_. Do not use the full secret key (sk_).',
    }
  }

  try {
    const client = new Stripe(rawKey, { apiVersion: API_VERSION })
    await client.charges.list({ limit: 1 })
    return { valid: true }
  } catch (err) {
    if (err instanceof Stripe.errors.StripeAuthenticationError) {
      return { valid: false, error: 'Invalid key — Stripe rejected the credentials.' }
    }
    if (err instanceof Stripe.errors.StripePermissionError) {
      return {
        valid: false,
        error: 'Key lacks required permissions. Enable "Charges: Read" in the Stripe Dashboard.',
      }
    }
    const msg = err instanceof Error ? err.message : 'Validation failed'
    return { valid: false, error: msg }
  }
}
