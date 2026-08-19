'use server'

import { revalidatePath } from 'next/cache'
import { getOwnerId, getCurrentUser } from '@/lib/auth'
import {
  validateStripeKey,
  saveStripeKey,
  deleteStripeKey,
  getStripeKeyStatus,
  registerWebhookEndpoint,
  removeWebhookEndpoint,
} from '@/lib/finance/stripe-key'
import { backfillStripe } from '@/lib/finance/stripe-sync'

/**
 * Where Stripe should send this user's webhooks.
 *
 * Must be a public URL — Stripe cannot reach localhost, so endpoint
 * registration is skipped in local development rather than failing the save.
 */
function appUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_APP_URL
  if (!url) return null
  if (url.includes('localhost') || url.includes('127.0.0.1')) return null
  return url
}

export async function saveStripeKeyAction(rawKey: string) {
  const [ownerId, user] = await Promise.all([getOwnerId(), getCurrentUser()])

  const trimmed = rawKey.trim()
  if (!trimmed) {
    return { success: false as const, error: 'Key cannot be empty.' }
  }

  const validation = await validateStripeKey(trimmed)
  if (!validation.valid) {
    return { success: false as const, error: validation.error }
  }

  await saveStripeKey(ownerId, trimmed, user?.email ?? '')

  // Warnings, not errors: the key is saved and useful either way. Each one
  // names something the user can still do without, so failing the whole save
  // over it would be worse than saying what is limited.
  const warnings: string[] = []

  if (!validation.invoicing) {
    warnings.push(validation.invoicingError)
  }

  const url = appUrl()
  if (!url) {
    warnings.push(
      'No public app URL is configured, so Stripe cannot send webhooks here. ' +
        'Invoice payments will not update automatically — use Refresh on an ' +
        'invoice to pull its current status.',
    )
  } else if (validation.invoicing) {
    // Only worth attempting when the key can invoice at all.
    const registered = await registerWebhookEndpoint(ownerId, trimmed, url)
    if (!registered.ok) warnings.push(registered.error)
  }

  // Auto-import after connecting so transactions appear immediately.
  // If the backfill fails (e.g. rate limit), the key is still saved and the
  // user can manually sync from the Finance page.
  try {
    await backfillStripe(ownerId)
  } catch {
    // swallow — key saved successfully, backfill can be retried
  }

  revalidatePath('/settings')
  revalidatePath('/finance')
  revalidatePath('/invoices')
  return { success: true as const, warnings }
}

export async function removeStripeKeyAction() {
  const ownerId = await getOwnerId()
  // Deregister before forgetting the key — deleteStripeKey clears the very
  // credentials the deregistration call needs.
  await removeWebhookEndpoint(ownerId)
  await deleteStripeKey(ownerId)
  revalidatePath('/settings')
  revalidatePath('/finance')
  revalidatePath('/invoices')
  return { success: true as const }
}

export async function getStripeKeyStatusAction() {
  const ownerId = await getOwnerId()
  return getStripeKeyStatus(ownerId)
}
