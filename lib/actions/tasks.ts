'use server'

import { revalidatePath } from 'next/cache'
import { getOwnerId } from '@/lib/auth'
import { createTask, listTasks, updateTask, deleteTask } from '@/lib/tasks'
import { createTaskSchema, updateTaskSchema, listTasksSchema } from '@/lib/tasks/validators'

export async function createTaskAction(data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = createTaskSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const task = await createTask(ownerId, parsed.data)
  if (!task) return { error: 'Project not found' }

  revalidatePath(`/projects/${parsed.data.projectId}`)
  return { task }
}

export async function listTasksAction(filters: unknown = {}) {
  const ownerId = await getOwnerId()
  const parsed = listTasksSchema.safeParse(filters)
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  const tasks = await listTasks(ownerId, parsed.data)
  return { tasks }
}

export async function updateTaskAction(id: string, data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = updateTaskSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  const task = await updateTask(ownerId, id, parsed.data)
  if (!task) return { error: 'Not found' }

  revalidatePath(`/projects/${task.projectId}`)
  return { task }
}

export async function deleteTaskAction(id: string) {
  const ownerId = await getOwnerId()

  const existing = await import('@/lib/db/client').then(({ prisma }) =>
    prisma.task.findFirst({ where: { id, ownerId }, select: { projectId: true } }),
  )

  const deleted = await deleteTask(ownerId, id)
  if (!deleted) return { error: 'Not found' }

  if (existing?.projectId) revalidatePath(`/projects/${existing.projectId}`)
  return { success: true }
}
