'use server'

import { revalidatePath } from 'next/cache'
import { getOwnerId, getCurrentUser } from '@/lib/auth'
import {
  validateStripeKey,
  saveStripeKey,
  deleteStripeKey,
  getStripeKeyStatus,
} from '@/lib/finance/stripe-key'
import { backfillStripe } from '@/lib/finance/stripe-sync'

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
  return { success: true as const }
}

export async function removeStripeKeyAction() {
  const ownerId = await getOwnerId()
  await deleteStripeKey(ownerId)
  revalidatePath('/settings')
  revalidatePath('/finance')
  return { success: true as const }
}

export async function getStripeKeyStatusAction() {
  const ownerId = await getOwnerId()
  return getStripeKeyStatus(ownerId)
}
