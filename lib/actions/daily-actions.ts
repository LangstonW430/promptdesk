'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import type { Prisma } from '@/lib/generated/prisma/client'
import { prisma } from '@/lib/db/client'
import { getOwnerId } from '@/lib/auth'
import { refreshClientSummary } from '@/lib/relationship-summary/refresh'

const completeFollowUpSchema = z.object({
  /** ISO date string for the next scheduled follow-up, or null to clear it. */
  nextFollowupDate: z.string().date().nullable().optional(),
  /** Optional short note logged as a 'call' activity. */
  noteText: z.string().max(2000).optional(),
})

export type CompleteFollowUpInput = z.infer<typeof completeFollowUpSchema>

export async function completeFollowUpAction(clientId: string, data: unknown) {
  const ownerId = await getOwnerId()

  const parsed = completeFollowUpSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const exists = await prisma.client.findFirst({
    where: { id: clientId, ownerId },
    select: { id: true },
  })
  if (!exists) return { error: 'Client not found' }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const { nextFollowupDate, noteText } = parsed.data
  const noteCreated = Boolean(noteText?.trim())

  await prisma.$transaction(async (tx) => {
    // 1. Mark follow-up done: stamp lastContactDate + update nextFollowupDate
    await tx.client.update({
      where: { id: clientId },
      data: {
        lastContactDate: today,
        ...(nextFollowupDate !== undefined && {
          nextFollowupDate: nextFollowupDate ? new Date(nextFollowupDate) : null,
        }),
      },
    })

    // 2. Log the follow-up completion as an activity
    await tx.activity.create({
      data: {
        ownerId,
        clientId,
        type: 'followup_done',
        detail: {
          scheduledNext: nextFollowupDate ?? null,
        } as unknown as Prisma.InputJsonValue,
      },
    })

    // 3. Optionally create a call note
    if (noteCreated) {
      const note = await tx.note.create({
        data: {
          ownerId,
          clientId,
          body: noteText!.trim(),
          noteType: 'call',
          occurredAt: today,
        },
      })
      await tx.activity.create({
        data: {
          ownerId,
          clientId,
          type: 'note_added',
          detail: {
            noteId: note.id,
            noteType: 'call',
          } as unknown as Prisma.InputJsonValue,
        },
      })
    }
  })

  // Refresh relationship summary if a note was added
  if (noteCreated) {
    await refreshClientSummary(ownerId, clientId)
  }

  revalidatePath('/daily-actions')
  revalidatePath('/dashboard')
  revalidatePath(`/clients/${clientId}`)

  return { success: true }
}
