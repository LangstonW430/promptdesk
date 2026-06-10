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

export const listTasksSchema = z.object({
  projectId: z.string().uuid().optional(),
  due:       z.enum(['today', 'overdue']).optional(),
})

export type CreateTaskInput = z.infer<typeof createTaskSchema>
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>
export type ListTasksInput  = z.infer<typeof listTasksSchema>
