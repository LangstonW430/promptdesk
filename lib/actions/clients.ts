'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { dashboardTag } from '@/lib/cache-tags'
import { getOwnerId } from '@/lib/auth'
import {
  createClient,
  updateClient,
  setClientArchived,
  deleteClient,
} from '@/lib/clients'
import {
  createClientSchema,
  updateClientSchema,
  archiveClientSchema,
} from '@/lib/clients/validators'

export async function createClientAction(data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = createClientSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  await createClient(ownerId, parsed.data)
  revalidatePath('/clients')
  updateTag(dashboardTag(ownerId))
  return { success: true }
}

// getClientByIdAction / listClientsAction were removed: both ran a full query
// (listClientsAction an unbounded, caller-filtered one) and then discarded the
// result to return a bare `{ success: true }`. Neither had a caller, and every
// `'use server'` export is a reachable RPC endpoint, so they were doing real
// database work on request without producing anything. The pages read this
// data directly through lib/clients.

export async function updateClientAction(id: string, data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = updateClientSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  const updated = await updateClient(ownerId, id, parsed.data)
  if (!updated) return { error: 'Not found' }
  revalidatePath('/clients')
  updateTag(dashboardTag(ownerId))
  revalidatePath(`/clients/${id}`)
  return { success: true }
}

export async function setClientArchivedAction(id: string, data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = archiveClientSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  const updated = await setClientArchived(ownerId, id, parsed.data.archived)
  if (!updated) return { error: 'Not found' }
  revalidatePath('/clients')
  updateTag(dashboardTag(ownerId))
  revalidatePath(`/clients/${id}`)
  return { success: true }
}

export async function deleteClientAction(id: string) {
  const ownerId = await getOwnerId()
  const deleted = await deleteClient(ownerId, id)
  if (!deleted) return { error: 'Not found' }
  revalidatePath('/clients')
  updateTag(dashboardTag(ownerId))
  return { success: true }
}

// changeClientStatusAction was removed with the column it wrote. A client's
// stage is now read off their projects (lib/clients/stage.ts), so it moves when
// the work does — quote them, start it, finish it, or archive them.
