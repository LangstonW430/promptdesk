import { prisma } from '@/lib/db/client'

/**
 * Client-level opportunity value, derived from projects.
 *
 * Clients used to carry their own `estimatedValue`, which put the number on the
 * person rather than on the work being proposed — and left it ambiguous what it
 * meant once that client had several projects at different stages. Value now
 * lives on `projects.budget`; anywhere the product still needs a figure per
 * client, it is the sum of that client's open project budgets.
 */

/**
 * Project statuses that count toward pipeline value.
 *
 * `proposed` is work that has been quoted but not won — the whole reason the
 * status exists, since without it a lead could not carry a number at all.
 * `active` is won work still in flight, which is still money attached to the
 * relationship. Completed work has already been billed, and `on_hold` /
 * `cancelled` are explicitly not expected to land, so none of them count.
 */
export const PIPELINE_PROJECT_STATUSES = ['proposed', 'active'] as const

/**
 * Sums open project budgets per client, for the given owner.
 *
 * Returns a Map keyed by clientId. A client with no open projects is absent
 * from the map rather than present with 0 — callers decide whether that means
 * "nothing" or "unknown", and the distinction matters for the Hot Leads queue,
 * which should not surface a lead nobody has quoted yet.
 *
 * Pass `clientIds` to scope the aggregate to a page's worth of rows instead of
 * every client the owner has.
 */
export async function pipelineValueByClient(
  ownerId: string,
  clientIds?: string[],
): Promise<Map<string, number>> {
  if (clientIds?.length === 0) return new Map()

  const groups = await prisma.project.groupBy({
    by: ['clientId'],
    where: {
      ownerId,
      isArchived: false,
      status: { in: [...PIPELINE_PROJECT_STATUSES] },
      ...(clientIds?.length ? { clientId: { in: clientIds } } : {}),
    },
    _sum: { budget: true },
  })

  return new Map(
    groups.map((g) => [g.clientId, Number(g._sum.budget ?? 0)]),
  )
}

/**
 * Pipeline value for a single client. Zero when they have no open projects.
 */
export async function pipelineValueForClient(
  ownerId: string,
  clientId: string,
): Promise<number> {
  const result = await prisma.project.aggregate({
    where: {
      ownerId,
      clientId,
      isArchived: false,
      status: { in: [...PIPELINE_PROJECT_STATUSES] },
    },
    _sum: { budget: true },
  })
  return Number(result._sum.budget ?? 0)
}

/**
 * Open project budgets summed per *client status*, for the pipeline breakdown
 * on the dashboard.
 *
 * Expressed as one grouped query over projects joined to their client rather
 * than a client-side reduce, so the dashboard does not have to load every
 * project to add up two numbers. Archived clients are excluded to match every
 * other dashboard figure.
 */
export async function pipelineValueByClientStatus(
  ownerId: string,
): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<{ status: string; total: number | null }[]>`
    SELECT c.status AS status, (SUM(p.budget))::float8 AS total
    FROM projects p
    JOIN clients c ON c.id = p.client_id
    WHERE p.owner_id = ${ownerId}::uuid
      AND p.is_archived = false
      AND p.status IN ('proposed', 'active')
      AND c.is_archived = false
    GROUP BY c.status
  `
  return new Map(rows.map((r) => [r.status, r.total ?? 0]))
}
