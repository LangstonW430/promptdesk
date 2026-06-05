import { prisma } from '@/lib/db/client'
import type { Project } from '@/lib/generated/prisma/client'

export type ProjectStatus = 'active' | 'completed' | 'on_hold' | 'cancelled'

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

export async function listProjects(
  ownerId: string,
  filters: ListProjectsFilters = {},
): Promise<Project[]> {
  return prisma.project.findMany({
    where: {
      ownerId,
      ...(filters.clientId !== undefined && { clientId: filters.clientId }),
      ...(filters.status !== undefined && { status: filters.status }),
    },
    orderBy: { updatedAt: 'desc' },
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
