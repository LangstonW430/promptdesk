import { z } from 'zod'

export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500),
  dueDate: z.string().date().optional(),
  clientId: z.string().uuid().optional(),
})

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  // null explicitly clears the date; undefined leaves it unchanged
  dueDate: z.string().date().nullable().optional(),
  isDone: z.boolean().optional(),
})

export const listTasksSchema = z.object({
  due: z.enum(['today', 'overdue']).optional(),
  clientId: z.string().uuid().optional(),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
export type ListTasksInput = z.infer<typeof listTasksSchema>
