'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getOwnerId } from '@/lib/auth'
import {
  createForm,
  updateForm,
  deleteForm,
} from '@/lib/forms'

const formFieldSchema = z.object({
  id:       z.string(),
  label:    z.string().min(1),
  type:     z.enum(['text', 'textarea', 'email', 'phone', 'number', 'select', 'checkbox']),
  required: z.boolean(),
  order:    z.number().int().nonnegative(),
  options:  z.array(z.string()).optional(),
})

const createFormSchema = z.object({
  projectId:   z.string().uuid(),
  title:       z.string().min(1, 'Title is required').max(200),
  description: z.string().max(1000).nullable().optional(),
  fields:      z.array(formFieldSchema).optional(),
})

const updateFormSchema = z.object({
  title:       z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  isActive:    z.boolean().optional(),
  fields:      z.array(formFieldSchema).optional(),
})

export async function createFormAction(data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = createFormSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    const form = await createForm(ownerId, parsed.data)
    revalidatePath('/forms')
    revalidatePath(`/projects/${parsed.data.projectId}`)
    return { form }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create form' }
  }
}

export async function updateFormAction(id: string, data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = updateFormSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    const form = await updateForm(ownerId, id, parsed.data)
    revalidatePath('/forms')
    revalidatePath(`/forms/${id}`)
    return { form }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update form' }
  }
}

export async function deleteFormAction(id: string) {
  const ownerId = await getOwnerId()
  try {
    await deleteForm(ownerId, id)
    revalidatePath('/forms')
    return { success: true as const }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete form' }
  }
}
