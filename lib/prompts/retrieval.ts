import { prisma } from '@/lib/db/client'
import type { RetrievalSpec } from '@/lib/prompt-engine/template-types'
import type {
  RawClient,
  RawNote,
  RawTask,
  RawActivity,
} from '@/lib/prompt-engine/types'
import { BUILT_IN_TEMPLATES } from '@/lib/prompt-engine/templates'

// ─── Template lookup ──────────────────────────────────────────────────────────

export interface TemplateRecord {
  id: string
  key: string
  name: string
  body: string
  scope: string
  tokenBudget: number
  version: number
}

/**
 * Find a prompt template by key for a given owner.
 * Prefers the user's custom copy (non-null ownerId) over the system default.
 * Falls back to the in-memory BUILT_IN_TEMPLATES if the DB has no match.
 */
export async function findTemplate(
  ownerId: string,
  key: string,
): Promise<TemplateRecord | null> {
  const row = await prisma.promptTemplate.findFirst({
    where: {
      key,
      isActive: true,
      OR: [{ ownerId }, { ownerId: null }],
    },
    // Non-null ownerId (user's copy) sorts before null (system template)
    orderBy: [{ ownerId: { sort: 'asc', nulls: 'last' } }],
    select: {
      id: true,
      key: true,
      name: true,
      body: true,
      scope: true,
      tokenBudget: true,
      version: true,
    },
  })

  if (row) return row

  // DB hasn't been seeded yet — fall back to in-memory built-ins
  const builtin = BUILT_IN_TEMPLATES.find((t) => t.key === key)
  if (!builtin) return null
  return {
    id: '',
    key: builtin.key,
    name: builtin.name,
    body: builtin.body,
    scope: builtin.scope,
    tokenBudget: builtin.tokenBudget,
    version: builtin.version,
  }
}

// ─── User profile ─────────────────────────────────────────────────────────────

export interface UserProfile {
  businessName: string | null
  businessType: string | null
  defaultAi: string | null
  currency: string
}

export async function getUserProfile(ownerId: string): Promise<UserProfile> {
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { businessName: true, businessType: true, defaultAi: true, settings: true },
  })
  const settings = (user?.settings ?? {}) as Record<string, unknown>
  const currency =
    typeof settings['currency'] === 'string' ? settings['currency'] : 'USD'
  return {
    businessName: user?.businessName ?? null,
    businessType: user?.businessType ?? null,
    defaultAi: user?.defaultAi ?? null,
    currency,
  }
}

// ─── Raw context data ─────────────────────────────────────────────────────────

export interface RawContextData {
  clients: RawClient[]
  notes: RawNote[]
  tasks: RawTask[]
  activities: RawActivity[]
}

/** Fetch raw context rows from the DB, scoped to ownerId. */
export async function fetchContext(
  ownerId: string,
  spec: RetrievalSpec,
  clientId?: string,
  clientIds?: string[],
): Promise<RawContextData> {
  const clients: RawClient[] = []
  const notes: RawNote[] = []
  const tasks: RawTask[] = []
  const activities: RawActivity[] = []

  if (spec.scope === 'global') {
    const statusFilter = spec.clientStatusFilter?.length
      ? { status: { in: spec.clientStatusFilter } }
      : {}

    const clientIdFilter = clientIds?.length ? { id: { in: clientIds } } : {}

    const rawClients = await prisma.client.findMany({
      where: { ownerId, isArchived: false, ...statusFilter, ...clientIdFilter },
      include: { clientTags: { include: { tag: true } } },
      orderBy: { updatedAt: 'desc' },
      take: spec.maxClients ?? 50,
    })

    for (const c of rawClients) {
      clients.push({
        id: c.id,
        companyName: c.companyName,
        contactName: c.contactName,
        email: c.email,
        phone: c.phone,
        website: c.website,
        industry: c.industry,
        companySize: c.companySize,
        leadSource: c.leadSource,
        status: c.status,
        estimatedValue: c.estimatedValue,
        projectType: c.projectType,
        painPoints: c.painPoints,
        requirements: c.requirements,
        opportunityNotes: c.opportunityNotes,
        lastContactDate: c.lastContactDate,
        nextFollowupDate: c.nextFollowupDate,
        tags: c.clientTags.map((ct) => ct.tag.label),
        customFields: c.customFields as Record<string, unknown>,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        relationshipSummary: c.relationshipSummary ?? null,
      })
    }

    const fetchedClientIds = rawClients.map((c) => c.id)

    // When specific clients are selected, also fetch their notes for richer context
    if (clientIds?.length && fetchedClientIds.length) {
      const rawNotes = await prisma.note.findMany({
        where: { ownerId, clientId: { in: fetchedClientIds } },
        orderBy: { occurredAt: 'desc' },
        take: spec.maxNotes ?? 30,
      })
      notes.push(...rawNotes.map((n) => ({
        id: n.id,
        clientId: n.clientId,
        body: n.body,
        noteType: n.noteType,
        occurredAt: n.occurredAt,
      })))
    }

    const taskClientFilter = clientIds?.length ? { project: { clientId: { in: fetchedClientIds } } } : {}
    const activityClientFilter = clientIds?.length ? { clientId: { in: fetchedClientIds } } : {}

    const [rawTasks, rawActivities] = await Promise.all([
      spec.includeOpenTasks
        ? prisma.task.findMany({
            where: { ownerId, isDone: false, ...taskClientFilter },
            orderBy: [{ dueDate: { sort: 'asc', nulls: 'last' } }],
            take: spec.maxOpenTasks ?? 100,
          })
        : Promise.resolve([] as Awaited<ReturnType<typeof prisma.task.findMany>>),
      spec.includeRecentActivities
        ? prisma.activity.findMany({
            where: { ownerId, ...activityClientFilter },
            orderBy: { createdAt: 'desc' },
            take: spec.maxActivities ?? 20,
          })
        : Promise.resolve([] as Awaited<ReturnType<typeof prisma.activity.findMany>>),
    ])

    tasks.push(...rawTasks.map((t) => ({
      id: t.id,
      clientId: null as string | null,
      projectId: t.projectId,
      title: t.title,
      dueDate: t.dueDate,
      isDone: t.isDone,
    })))

    activities.push(...rawActivities.map((a) => ({
      id: a.id,
      clientId: a.clientId,
      type: a.type,
      detail: a.detail as Record<string, unknown>,
      createdAt: a.createdAt,
    })))
  }

  if (spec.scope === 'client' || spec.scope === 'notes') {
    if (!clientId) return { clients, notes, tasks, activities }

    const c = await prisma.client.findFirst({
      where: { id: clientId, ownerId },
      include: { clientTags: { include: { tag: true } } },
    })
    if (c) {
      clients.push({
        id: c.id,
        companyName: c.companyName,
        contactName: c.contactName,
        email: c.email,
        phone: c.phone,
        website: c.website,
        industry: c.industry,
        companySize: c.companySize,
        leadSource: c.leadSource,
        status: c.status,
        estimatedValue: c.estimatedValue,
        projectType: c.projectType,
        painPoints: c.painPoints,
        requirements: c.requirements,
        opportunityNotes: c.opportunityNotes,
        lastContactDate: c.lastContactDate,
        nextFollowupDate: c.nextFollowupDate,
        tags: c.clientTags.map((ct) => ct.tag.label),
        customFields: c.customFields as Record<string, unknown>,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        relationshipSummary: c.relationshipSummary ?? null,
      })
    }

    if (spec.includeNotes !== false) {
      const noteWhere = spec.noteTypeFilter?.length
        ? { clientId, ownerId, noteType: { in: spec.noteTypeFilter } }
        : { clientId, ownerId }

      // When a relationship summary exists, months of history are already compressed
      // into the client block. Only fetch the most recent notes for freshness context.
      const hasSummary = !!c?.relationshipSummary
      const notesLimit = hasSummary ? Math.min(spec.maxNotes ?? 20, 5) : (spec.maxNotes ?? 20)

      const rawNotes = await prisma.note.findMany({
        where: noteWhere,
        orderBy: { occurredAt: 'desc' },
        take: notesLimit,
      })
      notes.push(...rawNotes.map((n) => ({
        id: n.id,
        clientId: n.clientId,
        body: n.body,
        noteType: n.noteType,
        occurredAt: n.occurredAt,
      })))
    }

    if (spec.scope === 'client') {
      if (spec.includeTasks !== false) {
        const rawTasks = await prisma.task.findMany({
          where: { ownerId, project: { clientId } },
          orderBy: [{ isDone: 'asc' }, { dueDate: { sort: 'asc', nulls: 'last' } }],
        })
        tasks.push(...rawTasks.map((t) => ({
          id: t.id,
          clientId: null as string | null,
          projectId: t.projectId,
          title: t.title,
          dueDate: t.dueDate,
          isDone: t.isDone,
        })))
      }

      if (spec.includeActivities !== false) {
        const rawActivities = await prisma.activity.findMany({
          where: { clientId, ownerId },
          orderBy: { createdAt: 'desc' },
          take: spec.maxActivities ?? 10,
        })
        activities.push(...rawActivities.map((a) => ({
          id: a.id,
          clientId: a.clientId,
          type: a.type,
          detail: a.detail as Record<string, unknown>,
          createdAt: a.createdAt,
        })))
      }
    }
  }

  return { clients, notes, tasks, activities }
}
