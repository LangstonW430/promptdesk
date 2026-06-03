import { prisma } from '@/lib/db/client'
import { buildRelationshipSummary } from './index'

/**
 * Re-derive and persist the relationship summary for a single client.
 * Called after note create/delete and status changes.
 * Fast: pure computation + one DB write; safe to await inline.
 */
export async function refreshClientSummary(
  ownerId: string,
  clientId: string,
): Promise<void> {
  const [client, notes, activities, tasks] = await Promise.all([
    prisma.client.findFirst({
      where: { id: clientId, ownerId },
      select: { status: true, createdAt: true },
    }),
    prisma.note.findMany({
      where: { clientId, ownerId },
      select: { body: true, noteType: true, occurredAt: true },
      orderBy: { occurredAt: 'asc' },
    }),
    prisma.activity.findMany({
      where: { clientId, ownerId, type: 'status_changed' },
      select: { detail: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.task.findMany({
      where: { clientId, ownerId },
      select: { isDone: true, dueDate: true },
    }),
  ])

  if (!client) return

  const now = new Date()

  const statusHistory = activities
    .filter((a) => {
      const d = a.detail as Record<string, unknown>
      return typeof d['from'] === 'string' && typeof d['to'] === 'string'
    })
    .map((a) => {
      const d = a.detail as Record<string, string>
      return { from: d['from'], to: d['to'], occurredAt: a.createdAt }
    })

  const openTaskCount = tasks.filter((t) => !t.isDone).length
  const overdueTaskCount = tasks.filter(
    (t) => !t.isDone && t.dueDate != null && new Date(t.dueDate) < now,
  ).length

  const summary = buildRelationshipSummary(
    {
      client: { status: client.status, createdAt: client.createdAt },
      notes: notes.map((n) => ({
        body: n.body,
        noteType: n.noteType,
        occurredAt: n.occurredAt,
      })),
      statusHistory,
      openTaskCount,
      overdueTaskCount,
    },
    now,
  )

  await prisma.client.update({
    where: { id: clientId },
    data: { relationshipSummary: summary, summaryUpdatedAt: now },
  })
}
