import type { Prisma } from '@/lib/generated/prisma/client'
import { prisma } from '@/lib/db/client'
import type { CreateTaskInput, UpdateTaskInput, ListTasksInput } from './validators'

function buildTaskWhere(
  ownerId: string,
  filters: ListTasksInput = {},
): Prisma.TaskWhereInput {
  const conditions: Prisma.TaskWhereInput[] = [{ ownerId }]

  if (filters.projectId) conditions.push({ projectId: filters.projectId })

  // A task has no `clientId` of its own — it hangs off a project, and the
  // project carries the client. The relation filter is still owner-scoped by
  // the first condition, but the project's own `ownerId` is checked too:
  // relying on the task's alone would trust that the two can never disagree,
  // and that is exactly the kind of assumption a later data repair breaks.
  if (filters.clientId) {
    conditions.push({ project: { clientId: filters.clientId, ownerId } })
  }

  // `done` and `open` are about completion; `due` is about dates. They used to
  // be one thing, with `due` implying `isDone: false`, which left no way to
  // ask for finished work at all. An omitted status still means "no filter",
  // so nothing that called this before sees a change.
  if (filters.status === 'open') conditions.push({ isDone: false })
  if (filters.status === 'done') conditions.push({ isDone: true })

  if (filters.due) {
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
      conditions.push({
        isDone: false,
        dueDate: { not: null, lt: todayStart },
      })
    }
  }

  return { AND: conditions }
}

export async function createTask(ownerId: string, input: CreateTaskInput) {
  // Archived projects are not valid targets for new work.
  const ok = await prisma.project.count({
    where: { id: input.projectId, ownerId, isArchived: false },
  })
  if (!ok) return null

  return prisma.task.create({
    data: {
      ownerId,
      projectId: input.projectId,
      title:     input.title,
      dueDate:   input.dueDate ? new Date(input.dueDate) : null,
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
    // Unbounded when no limit is given, which is what the task list page and
    // the REST route both expect. Callers whose output goes somewhere with a
    // fixed budget — an MCP response landing in a model's context — pass one.
    ...(filters.limit ? { take: filters.limit } : {}),
  })
}

/**
 * Tasks with the project and client they belong to.
 *
 * Separate from `listTasks` rather than an option on it because the join is
 * only worth paying for when the caller is going to render the names: the
 * task list page already knows which project it is showing.
 */
export async function listTasksWithContext(
  ownerId: string,
  filters: ListTasksInput = {},
) {
  return prisma.task.findMany({
    where: buildTaskWhere(ownerId, filters),
    orderBy: [
      { isDone: 'asc' },
      { dueDate: 'asc' },
      { createdAt: 'asc' },
    ],
    select: {
      id: true,
      title: true,
      dueDate: true,
      isDone: true,
      createdAt: true,
      project: {
        select: {
          id: true,
          title: true,
          status: true,
          client: { select: { id: true, companyName: true, contactName: true } },
        },
      },
    },
    ...(filters.limit ? { take: filters.limit } : {}),
  })
}

/** How many tasks match, ignoring any limit. Lets a caller report truncation. */
export async function countTasks(
  ownerId: string,
  filters: ListTasksInput = {},
): Promise<number> {
  return prisma.task.count({ where: buildTaskWhere(ownerId, filters) })
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
      ...(input.title   !== undefined && { title:   input.title }),
      ...(input.isDone  !== undefined && { isDone:  input.isDone }),
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
