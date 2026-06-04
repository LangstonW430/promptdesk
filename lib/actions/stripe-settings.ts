'use server'

import { revalidatePath } from 'next/cache'
import { getOwnerId } from '@/lib/auth'
import {
  validateStripeKey,
  saveStripeKey,
  deleteStripeKey,
  getStripeKeyStatus,
} from '@/lib/finance/stripe-key'

export async function saveStripeKeyAction(rawKey: string) {
  const ownerId = await getOwnerId()

  const trimmed = rawKey.trim()
  if (!trimmed) {
    return { success: false as const, error: 'Key cannot be empty.' }
  }

  const validation = await validateStripeKey(trimmed)
  if (!validation.valid) {
    return { success: false as const, error: validation.error }
  }

  await saveStripeKey(ownerId, trimmed)
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
