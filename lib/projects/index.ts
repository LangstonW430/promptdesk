import { prisma } from '@/lib/db/client'
import type { Project } from '@/lib/generated/prisma/client'

export type ProjectStatus = 'active' | 'completed' | 'on_hold' | 'cancelled'

export interface ProjectWithStats extends Omit<Project, 'budget'> {
  budget: number | null
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
  deliverables?: string[]
}

export interface UpdateProjectInput {
  title?: string
  status?: ProjectStatus
  startDate?: Date | null
  endDate?: Date | null
  budget?: number | null
  deliverables?: string[]
}

export interface ListProjectsFilters {
  clientId?: string
  status?: ProjectStatus
}

export async function createProject(
  ownerId: string,
  input: CreateProjectInput,
): Promise<Project> {
  // Verify the client belongs to this owner before creating the project under it.
  const clientCount = await prisma.client.count({
    where: { id: input.clientId, ownerId },
  })
  if (clientCount === 0) {
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
    const { client, budget, ...rest } = r
    return {
      ...rest,
      budget: budget != null
        ? (typeof budget === 'object' ? (budget as { toNumber(): number }).toNumber() : Number(budget))
        : null,
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
      ...(input.deliverables !== undefined && { deliverables: input.deliverables }),
    },
  })
}

export async function deleteProject(ownerId: string, id: string): Promise<void> {
  await prisma.project.deleteMany({ where: { id, ownerId } })
}
