'use server'

import { revalidatePath } from 'next/cache'
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
  const client = await createClient(ownerId, parsed.data)
  revalidatePath('/clients')
  return { client }
}

export async function getClientByIdAction(id: string) {
  const ownerId = await getOwnerId()
  const client = await getClientById(ownerId, id)
  if (!client) return { error: 'Not found' }
  return { client }
}

export async function listClientsAction(filters: ClientFilters = {}) {
  const ownerId = await getOwnerId()
  const clients = await listClients(ownerId, filters)
  return { clients }
}

export async function updateClientAction(id: string, data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = updateClientSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  const client = await updateClient(ownerId, id, parsed.data)
  if (!client) return { error: 'Not found' }
  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  return { client }
}

export async function setClientArchivedAction(id: string, data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = archiveClientSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  const client = await setClientArchived(ownerId, id, parsed.data.archived)
  if (!client) return { error: 'Not found' }
  revalidatePath('/clients')
  revalidatePath(`/clients/${id}`)
  return { client }
}

export async function deleteClientAction(id: string) {
  const ownerId = await getOwnerId()
  const deleted = await deleteClient(ownerId, id)
  if (!deleted) return { error: 'Not found' }
  revalidatePath('/clients')
  return { success: true }
}

export async function changeClientStatusAction(id: string, newStatus: string) {
  const ownerId = await getOwnerId()
  const result = await changeClientStatus(ownerId, id, newStatus as ClientStatus)
  if (!result) return { error: 'Not found or status unchanged' }
  revalidatePath('/clients')
  return { success: true }
}
