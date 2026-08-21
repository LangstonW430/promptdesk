'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { financeTag, dashboardTag } from '@/lib/cache-tags'
import { getOwnerId } from '@/lib/auth'
import {
  createTransaction,
  updateTransaction,
  supersedeStandingCharge,
  deleteTransaction,
  setTransactionHidden,
} from '@/lib/finance'
import {
  createTransactionSchema,
  updateTransactionSchema,
  supersedeStandingChargeSchema,
} from '@/lib/finance/validators'
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

/**
 * Records a rate change on a standing charge from a date forward, rather than
 * rewriting what every month it has already covered was billed.
 *
 * Kept apart from updateTransactionAction because the two answer different
 * questions. "This charge was always £49, I typed it wrong" is an update.
 * "This charge went from £49 to £99 in August" is this — and putting it through
 * an update would tell the ledger the higher tier had been running since the
 * day the subscription was first entered.
 */
export async function supersedeStandingChargeAction(id: string, data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = supersedeStandingChargeSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message }
  }
  try {
    const result = await supersedeStandingCharge(ownerId, id, parsed.data)
    if (!result) {
      return { success: false as const, error: 'Transaction not found' }
    }
    revalidatePath('/finance')
    revalidatePath('/dashboard')
    updateTag(financeTag(ownerId))
    updateTag(dashboardTag(ownerId))
    return { success: true as const, data: result }
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : 'Failed to record the rate change',
    }
  }
}

export async function deleteTransactionAction(id: string) {
  const ownerId = await getOwnerId()
  const deleted = await deleteTransaction(ownerId, id)
  if (!deleted) {
    return {
      success: false as const,
      error:
        'Transaction not found, or it came from Stripe — hide it instead, ' +
        'since deleting an imported row only brings it back on the next sync.',
    }
  }
  revalidatePath('/finance')
  revalidatePath('/dashboard')
  updateTag(financeTag(ownerId))
  updateTag(dashboardTag(ownerId))
  return { success: true as const }
}

/**
 * Takes a row off the ledger, or puts it back.
 *
 * The delete path refuses Stripe rows outright, because deleting one only makes
 * it come back on the next backfill. This is what the table offers for those
 * instead, and it is reversible.
 */
export async function setTransactionHiddenAction(id: string, hidden: boolean) {
  const ownerId = await getOwnerId()
  const transaction = await setTransactionHidden(ownerId, id, hidden)
  if (!transaction) {
    return { success: false as const, error: 'Transaction not found' }
  }
  revalidatePath('/finance')
  revalidatePath('/dashboard')
  updateTag(financeTag(ownerId))
  updateTag(dashboardTag(ownerId))
  return { success: true as const, data: transaction }
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
