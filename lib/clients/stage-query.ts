import { Prisma } from '@/lib/generated/prisma/client'
import { prisma } from '@/lib/db/client'
import { deriveClientStage, type ClientStage } from './stage'

interface StageRow {
  id: string
  is_archived: boolean
  has_active: boolean
  has_proposed: boolean
  has_completed: boolean
  contacted: boolean
}

function toStages(rows: StageRow[]): Map<string, ClientStage> {
  return new Map(
    rows.map((r) => [
      r.id,
      deriveClientStage({
        isArchived: r.is_archived,
        hasActiveProject: r.has_active,
        hasProposedProject: r.has_proposed,
        hasCompletedProject: r.has_completed,
        hasBeenContacted: r.contacted,
      }),
    ]),
  )
}

/**
 * Derives stages for a set of clients in one pass.
 *
 * The inputs live across three tables, so this aggregates them in SQL rather
 * than loading every project and note to answer five booleans per client.
 * Passing `clientIds` scopes it to a page's worth of rows instead of every
 * client the owner has.
 *
 * "Contacted" counts a recorded contact date *or* any logged note — someone you
 * have written a call note about has plainly been contacted, whether or not the
 * date field was filled in.
 */
export async function clientStagesFor(
  ownerId: string,
  clientIds?: string[],
): Promise<Map<string, ClientStage>> {
  if (clientIds?.length === 0) return new Map()

  const idFilter = clientIds?.length
    ? Prisma.sql`AND c.id = ANY(${clientIds}::uuid[])`
    : Prisma.empty

  const rows = await prisma.$queryRaw<StageRow[]>(Prisma.sql`
    SELECT
      c.id,
      c.is_archived,
      COALESCE(bool_or(p.status = 'active'   AND NOT p.is_archived), false) AS has_active,
      COALESCE(bool_or(p.status = 'proposed' AND NOT p.is_archived), false) AS has_proposed,
      COALESCE(bool_or(p.status = 'completed'), false)                      AS has_completed,
      (c.last_contact_date IS NOT NULL
        OR EXISTS (SELECT 1 FROM notes n WHERE n.client_id = c.id)) AS contacted
    FROM clients c
    LEFT JOIN projects p ON p.client_id = c.id
    WHERE c.owner_id = ${ownerId}::uuid
    ${idFilter}
    GROUP BY c.id, c.is_archived, c.last_contact_date
  `)

  return toStages(rows)
}

/** Counts of clients per derived stage, for the dashboard. */
export async function clientStageCounts(
  ownerId: string,
): Promise<Map<ClientStage, number>> {
  const stages = await clientStagesFor(ownerId)
  const counts = new Map<ClientStage, number>()
  for (const stage of stages.values()) {
    counts.set(stage, (counts.get(stage) ?? 0) + 1)
  }
  return counts
}
