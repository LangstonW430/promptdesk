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

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
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
    data: {
      stripeKey: null,
      stripeKeyHint: null,
      // The endpoint is deregistered separately (see removeWebhookEndpoint) —
      // this only forgets our side of it.
      webhookToken: null,
      stripeWebhookId: null,
      stripeWebhookSecret: null,
    },
  })
}

// ─── Per-user webhook endpoints ───────────────────────────────────────────────

/**
 * Registers a webhook endpoint on the user's own Stripe account.
 *
 * Stripe owns the invoice lifecycle now, which means an invoice's status only
 * ever reaches us by webhook. A single deployment-wide endpoint could not say
 * which user an event belonged to, so each account gets its own endpoint posting
 * to a path that carries an unguessable token identifying the owner.
 *
 * The signing secret Stripe returns is only readable at creation, so it is
 * encrypted and stored immediately — the same treatment as the API key.
 *
 * Replaces any endpoint we previously registered, so re-saving a key does not
 * leave a trail of stale endpoints firing at the same URL.
 *
 * Returns null when the key lacks permission to manage endpoints. That is not
 * fatal: invoicing still works, the user just has to refresh invoices by hand
 * until they widen the key. The caller surfaces that as a warning.
 */
export async function registerWebhookEndpoint(
  ownerId: string,
  rawKey: string,
  appUrl: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = new Stripe(rawKey, { apiVersion: API_VERSION })

  const existing = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { stripeWebhookId: true, webhookToken: true },
  })

  // Drop the previous endpoint first. Failure here is ignored: it usually means
  // the endpoint was already deleted in the Stripe dashboard, and refusing to
  // register a working one over it would be the worse outcome.
  if (existing?.stripeWebhookId) {
    try {
      await client.webhookEndpoints.del(existing.stripeWebhookId)
    } catch {
      // Already gone.
    }
  }

  // Reuse the existing token so an endpoint someone configured by hand against
  // the same URL keeps working.
  const token = existing?.webhookToken ?? randomBytes(24).toString('hex')

  try {
    const endpoint = await client.webhookEndpoints.create({
      url: `${appUrl.replace(/\/$/, '')}/api/webhooks/stripe/${token}`,
      enabled_events: [
        'charge.succeeded',
        'charge.updated',
        'charge.refunded',
        'invoice.finalized',
        'invoice.sent',
        'invoice.updated',
        'invoice.paid',
        'invoice.payment_succeeded',
        'invoice.payment_failed',
        'invoice.voided',
        'invoice.marked_uncollectible',
        'customer.created',
        'customer.updated',
        'customer.subscription.updated',
        'customer.subscription.deleted',
      ],
      description: 'PromptDesk',
    })

    if (!endpoint.secret) {
      return {
        ok: false,
        error: 'Stripe did not return a signing secret for the webhook endpoint.',
      }
    }

    await prisma.user.update({
      where: { id: ownerId },
      data: {
        webhookToken: token,
        stripeWebhookId: endpoint.id,
        stripeWebhookSecret: encryptKey(endpoint.secret),
      },
    })

    return { ok: true }
  } catch (err) {
    if (err instanceof Stripe.errors.StripePermissionError) {
      return {
        ok: false,
        error:
          'Your key cannot manage webhook endpoints. Add "Webhook Endpoints: Write" ' +
          'to it in Stripe to have invoice payments update automatically.',
      }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Could not register the webhook endpoint.',
    }
  }
}

/**
 * Deregisters the endpoint from the user's Stripe account.
 *
 * Best effort: if the key is already gone or lacks the permission, the stored
 * ids are cleared anyway so our side is consistent. A leftover endpoint in
 * Stripe posts to a token that no longer resolves and gets a 404, which is
 * visible in their dashboard rather than silently wrong.
 */
export async function removeWebhookEndpoint(ownerId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { stripeKey: true, stripeWebhookId: true },
  })
  if (!user?.stripeKey || !user.stripeWebhookId) return

  try {
    const client = new Stripe(decryptKey(user.stripeKey), { apiVersion: API_VERSION })
    await client.webhookEndpoints.del(user.stripeWebhookId)
  } catch {
    // Nothing actionable — the ids are cleared by deleteStripeKey regardless.
  }
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
 * Checks a raw key against the Stripe API before it is stored.
 *
 * Reading charges is the minimum for the finance import. Invoicing needs
 * considerably more — Stripe raises, numbers, renders and sends the invoice on
 * the user's behalf — and a key that cannot do it fails at the moment the user
 * hits Send, in front of a client who is waiting to be billed. So the write
 * scopes are probed here instead, at the one moment the user is looking at the
 * key settings and can widen them.
 *
 * `invoicing` is reported separately rather than failing the whole save: a
 * read-only key is still perfectly good for importing transactions, which is
 * what this feature originally was.
 */
export async function validateStripeKey(
  rawKey: string,
): Promise<
  | { valid: true; invoicing: true }
  | { valid: true; invoicing: false; invoicingError: string }
  | { valid: false; error: string }
> {
  if (!rawKey.startsWith('rk_')) {
    return {
      valid: false,
      error: 'Must be a restricted key starting with rk_. Do not use the full secret key (sk_).',
    }
  }

  const client = new Stripe(rawKey, { apiVersion: API_VERSION })

  try {
    await client.charges.list({ limit: 1 })
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
    return {
      valid: false,
      error: err instanceof Error ? err.message : 'Validation failed',
    }
  }

  // Probe the invoicing scopes with reads rather than writes: listing is
  // permitted by the same Write grant, and creating a throwaway invoice to test
  // would leave real objects in the user's Stripe account.
  try {
    await client.invoices.list({ limit: 1 })
    await client.customers.list({ limit: 1 })
  } catch (err) {
    if (err instanceof Stripe.errors.StripePermissionError) {
      return {
        valid: true,
        invoicing: false,
        invoicingError:
          'This key cannot raise invoices. To bill clients through PromptDesk, ' +
          'set Invoices, Customers and Tax Rates to Write on the key — ' +
          'transactions will still import in the meantime.',
      }
    }
    return {
      valid: true,
      invoicing: false,
      invoicingError:
        err instanceof Error ? err.message : 'Could not verify invoicing permissions.',
    }
  }

  return { valid: true, invoicing: true }
}
