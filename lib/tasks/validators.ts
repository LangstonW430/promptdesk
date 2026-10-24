import { z } from 'zod'

export const createTaskSchema = z.object({
  projectId: z.string().uuid('Project is required'),
  title:     z.string().min(1, 'Title is required').max(500),
  dueDate:   z.string().date().optional(),
})

export const updateTaskSchema = z.object({
  title:   z.string().min(1).max(500).optional(),
  dueDate: z.string().date().nullable().optional(),
  isDone:  z.boolean().optional(),
})

/**
 * Whether to list work still outstanding, work finished, or both.
 *
 * Split out from `due` because the two were conflated: `due: 'overdue'`
 * implied `isDone: false`, so there was no way to ask "everything on this
 * project" or "what did we finish" without reading the whole table. Defaults
 * are applied by the caller, not here, so an omitted filter stays omitted and
 * existing callers see no change.
 */
export const TASK_STATUSES = ['open', 'done', 'all'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const listTasksSchema = z.object({
  projectId: z.string().uuid().optional(),
  /**
   * Narrows to the tasks of one client's projects. A task has no `clientId`
   * of its own — it hangs off a project, and the project carries the client —
   * so this filters through the relation.
   */
  clientId:  z.string().uuid().optional(),
  status:    z.enum(TASK_STATUSES).optional(),
  due:       z.enum(['today', 'overdue']).optional(),
  /** Omitted means unbounded, which is what every existing caller expects. */
  limit:     z.number().int().min(1).max(500).optional(),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
export type ListTasksInput  = z.infer<typeof listTasksSchema>
