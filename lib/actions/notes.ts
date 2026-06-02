'use server'

import { revalidatePath } from 'next/cache'
import { getOwnerId } from '@/lib/auth'
import { createNote, deleteNote, listNotes, listActivities } from '@/lib/notes'
import { createNoteSchema } from '@/lib/notes/validators'

export async function createNoteAction(clientId: string, data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = createNoteSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  const note = await createNote(ownerId, clientId, parsed.data)
  if (!note) return { error: 'Client not found' }
  revalidatePath('/clients')
  revalidatePath(`/clients/${clientId}`)
  return { note }
}

export async function deleteNoteAction(noteId: string, clientId: string) {
  const ownerId = await getOwnerId()
  const deleted = await deleteNote(ownerId, noteId)
  if (!deleted) return { error: 'Not found' }
  revalidatePath('/clients')
  revalidatePath(`/clients/${clientId}`)
  return { success: true }
}

export async function listNotesAction(clientId: string) {
  const ownerId = await getOwnerId()
  const notes = await listNotes(ownerId, clientId)
  return { notes }
}

export async function listActivitiesAction(clientId: string) {
  const ownerId = await getOwnerId()
  const activities = await listActivities(ownerId, clientId)
  return { activities }
}
