'use server'

import { revalidatePath, updateTag } from 'next/cache'
import { dashboardTag } from '@/lib/cache-tags'
import { getOwnerId } from '@/lib/auth'
import {
  createClient,
  getClientById,
  listClients,
  updateClient,
  setClientArchived,
  deleteClient,
  changeClientStatus,
} from '@/lib/clients'
import {
  createClientSchema,
  updateClientSchema,
  archiveClientSchema,
} from '@/lib/clients/validators'
import type { ClientFilters, ClientStatus } from '@/lib/clients/types'

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

export async function getClientByIdAction(id: string) {
  const ownerId = await getOwnerId()
  const client = await getClientById(ownerId, id)
  if (!client) return { error: 'Not found' as const }
  return { success: true as const }
}

export async function listClientsAction(filters: ClientFilters = {}) {
  const ownerId = await getOwnerId()
  await listClients(ownerId, filters)
  return { success: true }
}

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

export async function changeClientStatusAction(id: string, newStatus: string) {
  const ownerId = await getOwnerId()
  const result = await changeClientStatus(ownerId, id, newStatus as ClientStatus)
  if (!result) return { error: 'Not found or status unchanged' }
  revalidatePath('/clients')
  updateTag(dashboardTag(ownerId))
  return { success: true }
}
