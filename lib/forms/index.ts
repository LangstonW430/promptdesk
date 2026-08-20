import { randomBytes } from 'crypto'
import { prisma } from '@/lib/db/client'

// ── Types ─────────────────────────────────────────────────────────────────────

export type FormFieldType = 'text' | 'textarea' | 'email' | 'phone' | 'number' | 'select' | 'checkbox'

export interface FormField {
  id: string
  label: string
  type: FormFieldType
  required: boolean
  order: number
  options?: string[] // for select type
}

export interface FormWithProject {
  id: string
  ownerId: string
  projectId: string
  title: string
  description: string | null
  publicToken: string
  isActive: boolean
  fields: FormField[]
  createdAt: Date
  updatedAt: Date
  projectTitle: string
  clientName: string
  submissionCount: number
}

export interface SerializedForm {
  id: string
  ownerId: string
  projectId: string
  title: string
  description: string | null
  publicToken: string
  isActive: boolean
  fields: FormField[]
  createdAt: string
  updatedAt: string
  projectTitle: string
  clientName: string
  submissionCount: number
}

export interface FormSubmissionRow {
  id: string
  formId: string
  submitterName: string | null
  submitterEmail: string | null
  answers: Record<string, unknown>
  submittedAt: string
}

export interface CreateFormInput {
  projectId: string
  title: string
  description?: string | null
  fields?: FormField[]
}

export interface UpdateFormInput {
  title?: string
  description?: string | null
  isActive?: boolean
  fields?: FormField[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generatePublicToken(): string {
  return randomBytes(24).toString('base64url')
}

function parseFields(raw: unknown): FormField[] {
  if (!Array.isArray(raw)) return []
  return raw as FormField[]
}

function serializeForm(row: Awaited<ReturnType<typeof fetchFormRow>>): SerializedForm {
  return {
    id: row.id,
    ownerId: row.ownerId,
    projectId: row.projectId,
    title: row.title,
    description: row.description,
    publicToken: row.publicToken,
    isActive: row.isActive,
    fields: parseFields(row.fields),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    projectTitle: row.project.title,
    clientName: row.project.client.companyName ?? row.project.client.contactName ?? 'Unknown',
    submissionCount: row._count.submissions,
  }
}

// `select` rather than `include` on `project`: a bare `include` pulls every
// column of Project, so any future column added there (e.g. `isArchived`)
// would be fetched here too even though forms never read it — and would
// break this query outright if that column isn't in the DB yet everywhere
// this app is deployed.
const formProjectSelect = {
  title: true,
  client: { select: { companyName: true, contactName: true } },
} as const

async function fetchFormRow(id: string, ownerId: string) {
  const row = await prisma.form.findFirst({
    where: { id, ownerId },
    include: {
      project: { select: formProjectSelect },
      _count: { select: { submissions: true } },
    },
  })
  if (!row) throw new Error('Form not found')
  return row
}

// ── Domain functions ──────────────────────────────────────────────────────────

export async function createForm(ownerId: string, input: CreateFormInput): Promise<SerializedForm> {
  // Archived projects are not valid targets for new work.
  const projectCount = await prisma.project.count({
    where: { id: input.projectId, ownerId, isArchived: false },
  })
  if (projectCount === 0) throw new Error('Project not found')

  const row = await prisma.form.create({
    data: {
      ownerId,
      projectId: input.projectId,
      title: input.title,
      description: input.description ?? null,
      publicToken: generatePublicToken(),
      fields: (input.fields ?? []) as object[],
    },
    include: {
      project: { select: formProjectSelect },
      _count: { select: { submissions: true } },
    },
  })
  return serializeForm(row)
}

export async function getFormById(ownerId: string, id: string): Promise<SerializedForm> {
  return serializeForm(await fetchFormRow(id, ownerId))
}

export async function listForms(ownerId: string, projectId?: string): Promise<SerializedForm[]> {
  const rows = await prisma.form.findMany({
    where: { ownerId, ...(projectId ? { projectId } : {}) },
    include: {
      project: { select: formProjectSelect },
      _count: { select: { submissions: true } },
    },
    orderBy: { updatedAt: 'desc' },
  })
  return rows.map(serializeForm)
}

export async function updateForm(
  ownerId: string,
  id: string,
  input: UpdateFormInput,
): Promise<SerializedForm> {
  const count = await prisma.form.count({ where: { id, ownerId } })
  if (count === 0) throw new Error('Form not found')

  await prisma.form.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...('description' in input && { description: input.description }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
      ...(input.fields !== undefined && { fields: input.fields as object[] }),
    },
  })
  return serializeForm(await fetchFormRow(id, ownerId))
}

export async function deleteForm(ownerId: string, id: string): Promise<void> {
  await prisma.form.deleteMany({ where: { id, ownerId } })
}

// ── Public (no auth) ──────────────────────────────────────────────────────────

export interface PublicFormData {
  id: string
  title: string
  description: string | null
  fields: FormField[]
  projectTitle: string
  ownerBusinessName: string | null
}

export async function getFormByPublicToken(token: string): Promise<PublicFormData | null> {
  const row = await prisma.form.findUnique({
    where: { publicToken: token },
    include: {
      project: { select: { title: true } },
      owner: { select: { businessName: true, fullName: true } },
    },
  })
  if (!row || !row.isActive) return null
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    fields: parseFields(row.fields),
    projectTitle: row.project.title,
    ownerBusinessName: row.owner.businessName ?? row.owner.fullName,
  }
}

/**
 * Bounds on what an unauthenticated submitter can store.
 *
 * This is the one write path in the app that never has a session behind it, so
 * it is the one place where "the request body is as large as the caller likes"
 * is a stranger's decision rather than a customer's. The public routes that
 * reach it are currently removed; these belong to the function rather than to
 * the route, so restoring the route does not restore the gap.
 */
const MAX_SUBMISSION_FIELD = 200
const MAX_ANSWERS = 100
const MAX_ANSWERS_BYTES = 50_000

function boundedField(value: string | undefined): string | null {
  if (!value) return null
  return value.slice(0, MAX_SUBMISSION_FIELD)
}

export async function createFormSubmission(
  formId: string,
  data: { submitterName?: string; submitterEmail?: string; answers: Record<string, unknown> },
): Promise<void> {
  // Verify form is active (public token was already validated upstream)
  const form = await prisma.form.findUnique({ where: { id: formId }, select: { isActive: true } })
  if (!form || !form.isActive) throw new Error('Form is not active')

  const answers = data.answers ?? {}
  if (Object.keys(answers).length > MAX_ANSWERS) {
    throw new Error('Submission has too many answers')
  }
  if (JSON.stringify(answers).length > MAX_ANSWERS_BYTES) {
    throw new Error('Submission is too large')
  }

  await prisma.formSubmission.create({
    data: {
      formId,
      submitterName: boundedField(data.submitterName),
      submitterEmail: boundedField(data.submitterEmail),
      answers: answers as object,
    },
  })
}

export async function listFormSubmissions(
  ownerId: string,
  formId: string,
): Promise<FormSubmissionRow[]> {
  const count = await prisma.form.count({ where: { id: formId, ownerId } })
  if (count === 0) throw new Error('Form not found')

  const rows = await prisma.formSubmission.findMany({
    where: { formId },
    orderBy: { submittedAt: 'desc' },
  })
  return rows.map((r) => ({
    id: r.id,
    formId: r.formId,
    submitterName: r.submitterName,
    submitterEmail: r.submitterEmail,
    answers: r.answers as Record<string, unknown>,
    submittedAt: r.submittedAt.toISOString(),
  }))
}
