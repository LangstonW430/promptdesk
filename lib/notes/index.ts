import type { Prisma } from '@/lib/generated/prisma/client'
import { prisma } from '@/lib/db/client'
import type { CreateNoteInput } from './validators'

export async function createNote(
  ownerId: string,
  clientId: string,
  input: CreateNoteInput,
) {
  // Verify ownership and fetch current lastContactDate in one query
  const client = await prisma.client.findFirst({
    where: { id: clientId, ownerId },
    select: { id: true, lastContactDate: true },
  })
  if (!client) return null

  // Normalise occurredAt to a date-only string, defaulting to today
  const occurredDateStr =
    input.occurredAt ?? new Date().toISOString().split('T')[0]
  const occurredAt = new Date(occurredDateStr)

  return prisma.$transaction(async (tx) => {
    const note = await tx.note.create({
      data: {
        ownerId,
        clientId,
        body: input.body,
        noteType: input.noteType ?? 'note',
        occurredAt,
      },
    })

    await tx.activity.create({
      data: {
        ownerId,
        clientId,
        type: 'note_added',
        detail: {
          noteId: note.id,
          noteType: note.noteType,
        } as unknown as Prisma.InputJsonValue,
      },
    })

    // Update lastContactDate only when occurredAt is equal to or more recent
    const currentDateStr = client.lastContactDate
      ? client.lastContactDate.toISOString().split('T')[0]
      : null

    if (!currentDateStr || occurredDateStr >= currentDateStr) {
      await tx.client.update({
        where: { id: clientId },
        data: { lastContactDate: occurredAt },
      })
    }

    return note
  })
}

export async function deleteNote(ownerId: string, noteId: string): Promise<boolean> {
  const result = await prisma.note.deleteMany({ where: { id: noteId, ownerId } })
  return result.count > 0
}

export async function listNotes(ownerId: string, clientId: string) {
  return prisma.note.findMany({
    where: { ownerId, clientId },
    orderBy: { occurredAt: 'desc' },
  })
}

export async function listActivities(
  ownerId: string,
  clientId: string,
  limit = 20,
) {
  return prisma.activity.findMany({
    where: { ownerId, clientId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
