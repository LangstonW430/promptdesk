'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { financeTag, dashboardTag } from '@/lib/cache-tags'
import { getOwnerId } from '@/lib/auth'
import { createTransaction, updateTransaction, deleteTransaction } from '@/lib/finance'
import { createTransactionSchema, updateTransactionSchema } from '@/lib/finance/validators'
import { backfillStripe } from '@/lib/finance/stripe-sync'

export async function createTransactionAction(data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = createTransactionSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message }
  }
  // createTransaction throws when a relation id does not belong to this owner.
  // Uncaught, that surfaces as the generic error boundary instead of a message
  // the form can show.
  try {
    const transaction = await createTransaction(ownerId, parsed.data)
    revalidatePath('/finance')
    revalidatePath('/dashboard')
    updateTag(financeTag(ownerId))
    updateTag(dashboardTag(ownerId))
    return { success: true as const, data: transaction }
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to save transaction',
    }
  }
}

export async function updateTransactionAction(id: string, data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = updateTransactionSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message }
  }
  try {
    const transaction = await updateTransaction(ownerId, id, parsed.data)
    if (!transaction) {
      return { success: false as const, error: 'Transaction not found' }
    }
    revalidatePath('/finance')
    revalidatePath('/dashboard')
    updateTag(financeTag(ownerId))
    updateTag(dashboardTag(ownerId))
    return { success: true as const, data: transaction }
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to save transaction',
    }
  }
}

export async function deleteTransactionAction(id: string) {
  const ownerId = await getOwnerId()
  const deleted = await deleteTransaction(ownerId, id)
  if (!deleted) {
    return {
      success: false as const,
      error: 'Transaction not found or cannot delete a Stripe-imported row',
    }
  }
  revalidatePath('/finance')
  revalidatePath('/dashboard')
  updateTag(financeTag(ownerId))
  updateTag(dashboardTag(ownerId))
  return { success: true as const }
}

export async function syncStripeAction() {
  const ownerId = await getOwnerId()
  try {
    await backfillStripe(ownerId)
    revalidatePath('/finance')
    revalidatePath('/dashboard')
    updateTag(financeTag(ownerId))
    updateTag(dashboardTag(ownerId))
    return { success: true as const }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Stripe sync failed'
    return { success: false as const, error: message }
  }
}
