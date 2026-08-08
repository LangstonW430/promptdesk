import { prisma } from '@/lib/db/client'
import type { Project } from '@/lib/generated/prisma/client'

/**
 * `proposed` is work that has been quoted but not won. It exists so an
 * opportunity can carry a budget before there is anything to deliver, which is
 * what pipeline value is summed from now that clients hold no estimate of
 * their own. See lib/clients/pipeline-value.ts.
 */
export type ProjectStatus = 'proposed' | 'active' | 'completed' | 'on_hold' | 'cancelled'

/** Prisma Decimals arrive as objects; every money column needs the same unwrap. */
function toNum(v: unknown): number | null {
  if (v == null) return null
  return typeof v === 'object' ? (v as { toNumber(): number }).toNumber() : Number(v)
}

export interface ProjectWithStats extends Omit<Project, 'budget' | 'rate'> {
  budget: number | null
  rate: number | null
  clientName: string
  totalHours: number
  billableAmount: number
}

export interface CreateProjectInput {
  clientId: string
  title: string
  status?: ProjectStatus
  startDate?: Date | null
  endDate?: Date | null
  budget?: number | null
  rate?: number | null
  deliverables?: string[]
}

export interface UpdateProjectInput {
  title?: string
  status?: ProjectStatus
  startDate?: Date | null
  endDate?: Date | null
  budget?: number | null
  rate?: number | null
  deliverables?: string[]
}

export interface ListProjectsFilters {
  clientId?: string
  status?: ProjectStatus
  /** Include archived projects instead of active ones. Defaults to false. */
  archived?: boolean
}

export async function createProject(
  ownerId: string,
  input: CreateProjectInput,
): Promise<Project> {
  // Verify the client belongs to this owner before creating the project under
  // it. `defaultRate` comes back in the same round trip because it seeds the
  // project's rate when the caller does not supply one.
  const client = await prisma.client.findFirst({
    where: { id: input.clientId, ownerId },
    select: { defaultRate: true },
  })
  if (!client) {
    throw new Error('Client not found')
  }

  return prisma.project.create({
    data: {
      ownerId,
      clientId: input.clientId,
      title: input.title,
      status: input.status ?? 'active',
      startDate: input.startDate ?? null,
      endDate: input.endDate ?? null,
      budget: input.budget ?? null,
      // Falls back to the client's stored rate so a first project starts where
      // the client left off rather than blank. `?? null` would not do: an
      // explicit null from the caller means "no rate", and must win.
      rate: input.rate !== undefined ? input.rate : (client.defaultRate ?? null),
      deliverables: input.deliverables ?? [],
    },
  })
}

export async function getProjectById(
  ownerId: string,
  id: string,
): Promise<(Project & { tasks: Awaited<ReturnType<typeof prisma.task.findMany>> }) | null> {
  return prisma.project.findFirst({
    where: { id, ownerId },
    include: { tasks: { orderBy: { dueDate: 'asc' } } },
  })
}

/**
 * Id, title and owning client for every project a new record can be attached
 * to — the finance form's project picker, and anywhere else that needs to
 * offer "which piece of work is this for?".
 *
 * Archived and cancelled projects are left out: attaching new money or new
 * files to work that is over is not something to offer.
 */
export async function listProjectOptions(
  ownerId: string,
): Promise<Array<{ id: string; title: string; clientId: string }>> {
  return prisma.project.findMany({
    where: { ownerId, isArchived: false, status: { not: 'cancelled' } },
    select: { id: true, title: true, clientId: true },
    orderBy: [{ updatedAt: 'desc' }],
  })
}

/**
 * Per-project time totals, aggregated in the database.
 *
 * This previously came back as `include: { timeEntries: ... }` and was summed
 * in JS, which pulled every time entry of every project over the wire just to
 * produce two numbers per project. `billableAmount` is SUM(hours * rate),
 * which Prisma's `groupBy` cannot express, so this drops to raw SQL.
 */
async function timeStatsByProject(
  ownerId: string,
): Promise<Map<string, { totalHours: number; billableAmount: number }>> {
  const rows = await prisma.$queryRaw<
    { project_id: string; total_hours: number | null; billable_amount: number | null }[]
  >`
    SELECT project_id,
           (SUM(hours))::float8 AS total_hours,
           (SUM(hours * rate) FILTER (WHERE is_billable AND rate IS NOT NULL))::float8
             AS billable_amount
    FROM time_entries
    WHERE owner_id = ${ownerId}::uuid
    GROUP BY project_id
  `

  return new Map(
    rows.map((r) => [
      r.project_id,
      {
        totalHours: r.total_hours ?? 0,
        billableAmount: r.billable_amount ?? 0,
      },
    ]),
  )
}

export async function listProjects(
  ownerId: string,
  filters: ListProjectsFilters = {},
): Promise<ProjectWithStats[]> {
  const [rows, timeStats] = await Promise.all([
    prisma.project.findMany({
      where: {
        ownerId,
        isArchived: filters.archived ?? false,
        ...(filters.clientId !== undefined && { clientId: filters.clientId }),
        ...(filters.status !== undefined && { status: filters.status }),
      },
      include: {
        client: { select: { companyName: true, contactName: true } },
      },
      orderBy: { updatedAt: 'desc' },
    }),
    timeStatsByProject(ownerId),
  ])

  return rows.map((r) => {
    const stats = timeStats.get(r.id)
    const { client, budget, rate, ...rest } = r
    return {
      ...rest,
      budget: toNum(budget),
      rate: toNum(rate),
      clientName: client.companyName ?? client.contactName ?? 'Unknown',
      totalHours: stats?.totalHours ?? 0,
      billableAmount: stats?.billableAmount ?? 0,
    }
  })
}

export async function updateProject(
  ownerId: string,
  id: string,
  input: UpdateProjectInput,
): Promise<Project> {
  const count = await prisma.project.count({ where: { id, ownerId } })
  if (count === 0) throw new Error('Project not found')

  return prisma.project.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.status !== undefined && { status: input.status }),
      ...('startDate' in input && { startDate: input.startDate }),
      ...('endDate' in input && { endDate: input.endDate }),
      ...('budget' in input && { budget: input.budget }),
      ...('rate' in input && { rate: input.rate }),
      ...(input.deliverables !== undefined && { deliverables: input.deliverables }),
    },
  })
}

/**
 * Archive or unarchive a project.
 *
 * Purely a visibility flag: time entries and invoices that reference the
 * project keep working and stay visible, the same way archiving a client
 * leaves their transactions in Finance. Returns null when the project does not
 * belong to this owner.
 */
export async function setProjectArchived(
  ownerId: string,
  id: string,
  archived: boolean,
): Promise<Project | null> {
  const count = await prisma.project.count({ where: { id, ownerId } })
  if (count === 0) return null

  return prisma.project.update({
    where: { id },
    data: { isArchived: archived },
  })
}

export async function deleteProject(ownerId: string, id: string): Promise<void> {
  await prisma.project.deleteMany({ where: { id, ownerId } })
}

/**
 * Whether a project is a valid target for new work (time entries, tasks,
 * forms). Archived projects are not.
 */
export async function isProjectActionable(
  ownerId: string,
  projectId: string,
): Promise<boolean> {
  const count = await prisma.project.count({
    where: { id: projectId, ownerId, isArchived: false },
  })
  return count > 0
}
