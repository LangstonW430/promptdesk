import type { Prisma } from '@/lib/generated/prisma/client'
import { prisma } from '@/lib/db/client'
import type { CreateTaskInput, UpdateTaskInput, ListTasksInput } from './validators'

function buildTaskWhere(
  ownerId: string,
  filters: ListTasksInput = {},
): Prisma.TaskWhereInput {
  const conditions: Prisma.TaskWhereInput[] = [{ ownerId }]

  if (filters.clientId) conditions.push({ clientId: filters.clientId })

  if (filters.due) {
    // Compute today's boundary at midnight UTC for consistent date comparisons
    const todayStr = new Date().toISOString().split('T')[0]
    const todayStart = new Date(todayStr)
    const tomorrowStart = new Date(todayStr)
    tomorrowStart.setDate(tomorrowStart.getDate() + 1)

    if (filters.due === 'today') {
      conditions.push({
        isDone: false,
        dueDate: { gte: todayStart, lt: tomorrowStart },
      })
    } else {
      // overdue
      conditions.push({
        isDone: false,
        dueDate: { not: null, lt: todayStart },
      })
    }
  }

  return { AND: conditions }
}

export async function createTask(ownerId: string, input: CreateTaskInput) {
  if (input.clientId) {
    const ok = await prisma.client.count({ where: { id: input.clientId, ownerId } })
    if (!ok) return null
  }

  return prisma.task.create({
    data: {
      ownerId,
      title: input.title,
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      clientId: input.clientId ?? null,
    },
  })
}

export async function listTasks(ownerId: string, filters: ListTasksInput = {}) {
  return prisma.task.findMany({
    where: buildTaskWhere(ownerId, filters),
    orderBy: [
      { isDone: 'asc' },
      { dueDate: 'asc' },
      { createdAt: 'asc' },
    ],
  })
}

export async function updateTask(
  ownerId: string,
  id: string,
  input: UpdateTaskInput,
) {
  const exists = await prisma.task.count({ where: { id, ownerId } })
  if (!exists) return null

  return prisma.task.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.isDone !== undefined && { isDone: input.isDone }),
      ...(input.dueDate !== undefined && {
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
      }),
    },
  })
}

export async function deleteTask(ownerId: string, id: string): Promise<boolean> {
  const result = await prisma.task.deleteMany({ where: { id, ownerId } })
  return result.count > 0
}
