'use server'

import { revalidatePath } from 'next/cache'
import { getOwnerId } from '@/lib/auth'
import {
  createTimeEntry,
  listTimeEntries,
  updateTimeEntry,
  deleteTimeEntry,
  convertToInvoice,
  type ListTimeEntriesFilters,
} from '@/lib/time-entries'
import {
  createTimeEntrySchema,
  updateTimeEntrySchema,
  convertToInvoiceSchema,
} from '@/lib/time-entries/validators'

export async function createTimeEntryAction(data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = createTimeEntrySchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    const entry = await createTimeEntry(ownerId, parsed.data)
    revalidatePath('/time')
    revalidatePath(`/clients/${parsed.data.clientId}`)
    if (parsed.data.projectId) revalidatePath(`/projects/${parsed.data.projectId}`)
    return { entry }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create entry' }
  }
}

export async function listTimeEntriesAction(filters: ListTimeEntriesFilters = {}) {
  const ownerId = await getOwnerId()
  const entries = await listTimeEntries(ownerId, filters)
  return { entries }
}

export async function updateTimeEntryAction(id: string, data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = updateTimeEntrySchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const entry = await updateTimeEntry(ownerId, id, parsed.data)
  if (!entry) return { error: 'Not found' }

  revalidatePath('/time')
  revalidatePath(`/clients/${entry.clientId}`)
  return { entry }
}

export async function deleteTimeEntryAction(id: string) {
  const ownerId = await getOwnerId()

  // Fetch clientId before deleting so we can revalidate the right path
  const existing = await import('@/lib/db/client').then(({ prisma }) =>
    prisma.timeEntry.findFirst({ where: { id, ownerId }, select: { clientId: true } }),
  )

  const deleted = await deleteTimeEntry(ownerId, id)
  if (!deleted) return { error: 'Not found' }

  revalidatePath('/time')
  if (existing?.clientId) revalidatePath(`/clients/${existing.clientId}`)
  return { success: true }
}

export async function convertToInvoiceAction(data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = convertToInvoiceSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    const transaction = await convertToInvoice(ownerId, parsed.data.entryIds)
    revalidatePath('/finance')
    revalidatePath('/time')
    revalidatePath('/dashboard')
    return { success: true as const, transactionId: transaction.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Conversion failed' }
  }
}
