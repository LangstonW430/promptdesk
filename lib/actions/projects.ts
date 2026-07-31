'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getOwnerId } from '@/lib/auth'
import {
  createProject,
  updateProject,
  deleteProject,
  setProjectArchived,
} from '@/lib/projects'

const createProjectSchema = z.object({
  clientId:     z.string().uuid(),
  title:        z.string().min(1, 'Title is required').max(200),
  status:       z.enum(['active', 'completed', 'on_hold', 'cancelled']).default('active'),
  startDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  budget:       z.number().positive().nullable().optional(),
  deliverables: z.array(z.string()).optional(),
})

const updateProjectSchema = z.object({
  title:        z.string().min(1).max(200).optional(),
  status:       z.enum(['active', 'completed', 'on_hold', 'cancelled']).optional(),
  startDate:    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  endDate:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  budget:       z.number().positive().nullable().optional(),
  deliverables: z.array(z.string()).optional(),
})

export async function createProjectAction(data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = createProjectSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    const project = await createProject(ownerId, {
      ...parsed.data,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
      endDate:   parsed.data.endDate   ? new Date(parsed.data.endDate)   : null,
    })
    revalidatePath('/projects')
    revalidatePath(`/clients/${parsed.data.clientId}`)
    return { project }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create project' }
  }
}

export async function updateProjectAction(id: string, data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = updateProjectSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    const d = parsed.data
    const project = await updateProject(ownerId, id, {
      ...(d.title        !== undefined && { title:        d.title }),
      ...(d.status       !== undefined && { status:       d.status }),
      ...(d.deliverables !== undefined && { deliverables: d.deliverables }),
      ...('budget'    in d && { budget:    d.budget }),
      ...('startDate' in d && { startDate: d.startDate ? new Date(d.startDate) : null }),
      ...('endDate'   in d && { endDate:   d.endDate   ? new Date(d.endDate)   : null }),
    })
    revalidatePath('/projects')
    revalidatePath(`/projects/${id}`)
    return { project }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update project' }
  }
}

const archiveProjectSchema = z.object({ archived: z.boolean() })

export async function setProjectArchivedAction(id: string, data: unknown) {
  const ownerId = await getOwnerId()
  const parsed = archiveProjectSchema.safeParse(data)
  if (!parsed.success) return { error: parsed.error.issues[0].message }

  try {
    const project = await setProjectArchived(ownerId, id, parsed.data.archived)
    if (!project) return { error: 'Project not found' }
    revalidatePath('/projects')
    revalidatePath(`/projects/${id}`)
    // Archived projects drop out of the client detail page and the invoice,
    // form and time-entry pickers, so those surfaces need refreshing too.
    revalidatePath(`/clients/${project.clientId}`)
    revalidatePath('/forms')
    revalidatePath('/time')
    return { project }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to archive project' }
  }
}

export async function deleteProjectAction(id: string) {
  const ownerId = await getOwnerId()
  try {
    await deleteProject(ownerId, id)
    revalidatePath('/projects')
    return { success: true as const }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete project' }
  }
}
