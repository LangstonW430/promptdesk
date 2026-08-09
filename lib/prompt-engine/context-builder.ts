import type {
  EngineClient,
  EngineNote,
  EngineTask,
  EngineActivity,
  ScorableItem,
  ScorableClient,
  ScorableNote,
  ScorableTask,
  ScorableActivity,
  ScoredItem,
  IncludedItem,
  PipelineAggregate,
  ClientStage,
  EngineClientProject,
} from './types'
import type { ScoreBreakdown } from './types'
import { estimateTokens } from './renderer'
import { CLIENT_STAGES, CLIENT_STAGE_LABELS, STAGE_PROBABILITY } from '@/lib/clients/stage'

// ─── Pipeline aggregate ───────────────────────────────────────────────────────

// Probability of the relationship turning into revenue, shared with the rest of
// the app so the weighted pipeline here and the one on the dashboard cannot
// disagree.
const STAGE_PROBABILITIES = STAGE_PROBABILITY

// Nothing left to chase: the work is done, or the client is archived.
const INACTIVE = new Set<ClientStage>(['past', 'lost'])

export function computePipelineAggregate(
  clients: EngineClient[],
  now: Date,
  currency = 'USD',
): PipelineAggregate {
  const stageCounts = Object.fromEntries(
    CLIENT_STAGES.map((s) => [s, 0]),
  ) as Record<ClientStage, number>

  let weightedValue = 0
  let staleCount = 0
  let overdueCount = 0

  for (const c of clients) {
    stageCounts[c.stage] = (stageCounts[c.stage] ?? 0) + 1

    const value = c.estimatedValue ?? 0
    weightedValue += value * (STAGE_PROBABILITIES[c.stage] ?? 0)

    if (!INACTIVE.has(c.stage)) {
      const lastContact = c.updatedAt ? new Date(c.updatedAt) : null
      const daysSince = lastContact
        ? (now.getTime() - lastContact.getTime()) / 86_400_000
        : Infinity
      if (daysSince >= 30) staleCount++
    }

    if (c.nextFollowupDate && new Date(c.nextFollowupDate) < now) {
      overdueCount++
    }
  }

  const totalActive = clients.filter((c) => !INACTIVE.has(c.stage)).length

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(weightedValue)

  return {
    totalActive,
    stageCounts,
    weightedPipelineValue: weightedValue,
    weightedPipelineValueFormatted: formatted,
    staleClientCount: staleCount,
    overdueFollowUpCount: overdueCount,
    currency,
  }
}

// ─── ScorableItem builders ────────────────────────────────────────────────────

function clientSearchText(c: EngineClient): string {
  return [
    c.companyName, c.contactName, c.industry,
    ...c.projects.map((p) => p.title),
    c.painPoints, c.requirements, c.opportunityNotes, ...c.tags,
  ]
    .filter(Boolean)
    .join(' ')
}

export function toScorableClient(c: EngineClient): ScorableClient {
  return {
    kind: 'client',
    id: c.id,
    stage: c.stage,
    estimatedValue: c.estimatedValue,
    lastContactDate: c.updatedAt,   // use updatedAt as proxy when lastContactDate is a string
    nextFollowupDate: c.nextFollowupDate
      ? new Date(c.nextFollowupDate).toISOString()
      : null,
    updatedAt: c.updatedAt,
    searchText: clientSearchText(c),
  }
}

export function toScorableNote(
  n: EngineNote,
  clientMap: Map<string, EngineClient>,
): ScorableNote {
  const client = clientMap.get(n.clientId)
  return {
    kind: 'note',
    id: n.id,
    clientStage: client?.stage,
    clientEstimatedValue: client?.estimatedValue ?? null,
    occurredAt: n.occurredAt,
    searchText: n.body,
  }
}

export function toScorableTask(
  t: EngineTask,
  clientMap: Map<string, EngineClient>,
): ScorableTask {
  const client = t.clientId ? clientMap.get(t.clientId) : undefined
  return {
    kind: 'task',
    id: t.id,
    clientStage: client?.stage,
    clientEstimatedValue: client?.estimatedValue ?? null,
    dueDate: t.dueDate ? new Date(t.dueDate).toISOString() : null,
    isDone: t.isDone,
    searchText: t.title,
  }
}

export function toScorableActivity(
  a: EngineActivity,
  clientMap: Map<string, EngineClient>,
): ScorableActivity {
  const client = a.clientId ? clientMap.get(a.clientId) : undefined
  return {
    kind: 'activity',
    id: a.id,
    clientStage: client?.stage,
    clientEstimatedValue: client?.estimatedValue ?? null,
    occurredAt: a.occurredAt,
    searchText: `${a.type} ${JSON.stringify(a.detail)}`,
  }
}

// ─── Content renderers ────────────────────────────────────────────────────────

function line(label: string, value: string | null | undefined): string {
  return value ? `${label}: ${value}` : ''
}

/**
 * The client's work, one line per project. This replaces a single free-text
 * "Project type" on the client — a model asked to plan a week can now see that
 * there is a $22k proposal outstanding and a $5k build underway, rather than
 * the word "consulting".
 */
function projectLines(projects: EngineClientProject[]): string {
  if (projects.length === 0) return ''
  const rendered = projects.map((p) =>
    `  - ${p.title} (${p.status}${p.budgetFormatted ? `, ${p.budgetFormatted}` : ''})`,
  )
  return ['Projects:', ...rendered].join('\n')
}

function compactLines(parts: (string | null | undefined)[]): string {
  return parts.filter(Boolean).join('\n')
}

function clientFullContent(c: EngineClient): string {
  const header =
    [c.companyName, c.contactName ? `(Contact: ${c.contactName})` : null]
      .filter(Boolean)
      .join(' ') || c.id

  const row1 = [
    CLIENT_STAGE_LABELS[c.stage],
    c.estimatedValueFormatted ? `Value: ${c.estimatedValueFormatted}` : null,
    c.industry ? `Industry: ${c.industry}` : null,
  ]
    .filter(Boolean)
    .join('  |  ')

  const row2 = [
    c.lastContactDate ? `Last contact: ${c.lastContactDate}` : null,
    c.nextFollowupDate ? `Next follow-up: ${c.nextFollowupDate}` : null,
  ]
    .filter(Boolean)
    .join('  |  ')

  return compactLines([
    `--- CLIENT: ${header} ---`,
    row1,
    row2,
    projectLines(c.projects),
    line('Pain points', c.painPoints),
    line('Requirements', c.requirements),
    line('Opportunity', c.opportunityNotes),
    c.tags.length > 0 ? `Tags: ${c.tags.join(', ')}` : null,
    // Relationship summary compresses months of notes and stage history into ~300 tokens.
    // When present it replaces bulk note retrieval for Client Insight prompts.
    c.relationshipSummary ? `\n${c.relationshipSummary}` : null,
  ])
}

function clientSummary(c: EngineClient): string {
  return [
    c.companyName ?? c.id,
    CLIENT_STAGE_LABELS[c.stage],
    c.estimatedValueFormatted,
    c.lastContactDate ? `last contact ${c.lastContactDate}` : null,
  ]
    .filter(Boolean)
    .join(' — ')
}

function noteFullContent(n: EngineNote): string {
  const date = new Date(n.occurredAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  return `[${n.noteType} — ${date}]\n${n.body}`
}

function noteSummary(n: EngineNote): string {
  const date = new Date(n.occurredAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  const snippet = n.body.length > 120 ? `${n.body.slice(0, 117)}…` : n.body
  return `${date} ${n.noteType}: ${snippet}`
}

function taskFullContent(t: EngineTask, now: Date): string {
  const overdue =
    !t.isDone && t.dueDate != null && new Date(t.dueDate) < now ? ' — OVERDUE' : ''
  const dueStr = t.dueDate ? `due ${t.dueDate}${overdue}` : 'no due date'
  const done = t.isDone ? ' — DONE' : ''
  return `[Task — ${dueStr}${done}]\n${t.title}`
}

function taskSummary(t: EngineTask, now: Date): string {
  const overdue =
    !t.isDone && t.dueDate != null && new Date(t.dueDate) < now ? ' OVERDUE' : ''
  const dueStr = t.dueDate ? `due ${t.dueDate}${overdue}` : 'no due date'
  return `Task (${dueStr}): ${t.title}`
}

function activityFullContent(a: EngineActivity): string {
  const date = new Date(a.occurredAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  const detail =
    typeof a.detail === 'object' && Object.keys(a.detail).length > 0
      ? ` — ${JSON.stringify(a.detail)}`
      : ''
  return `[${a.type} — ${date}${detail}]`
}

function activitySummary(a: EngineActivity): string {
  const date = new Date(a.occurredAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  })
  return `${date} ${a.type}`
}

// ─── ScoredItem builders ──────────────────────────────────────────────────────

export function toScoredClient(
  c: EngineClient,
  breakdown: ScoreBreakdown,
): ScoredItem {
  const full = clientFullContent(c)
  return {
    id: c.id,
    type: 'client',
    score: breakdown.composite,
    reason: breakdown.reason,
    fullContent: full,
    summaryContent: clientSummary(c),
    estimatedTokens: estimateTokens(full),
  }
}

export function toScoredNote(
  n: EngineNote,
  breakdown: ScoreBreakdown,
): ScoredItem {
  const full = noteFullContent(n)
  return {
    id: n.id,
    type: 'note',
    score: breakdown.composite,
    reason: breakdown.reason,
    fullContent: full,
    summaryContent: noteSummary(n),
    estimatedTokens: estimateTokens(full),
  }
}

export function toScoredTask(
  t: EngineTask,
  breakdown: ScoreBreakdown,
  now: Date,
): ScoredItem {
  const full = taskFullContent(t, now)
  return {
    id: t.id,
    type: 'task',
    score: breakdown.composite,
    reason: breakdown.reason,
    fullContent: full,
    summaryContent: taskSummary(t, now),
    estimatedTokens: estimateTokens(full),
  }
}

export function toScoredActivity(
  a: EngineActivity,
  breakdown: ScoreBreakdown,
): ScoredItem {
  const full = activityFullContent(a)
  return {
    id: a.id,
    type: 'activity',
    score: breakdown.composite,
    reason: breakdown.reason,
    fullContent: full,
    summaryContent: activitySummary(a),
    estimatedTokens: estimateTokens(full),
  }
}

// ─── Context block assembler ──────────────────────────────────────────────────

function aggregateHeader(agg: PipelineAggregate): string {
  const byStage = (Object.entries(agg.stageCounts) as [ClientStage, number][])
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${CLIENT_STAGE_LABELS[s]}: ${n}`)
    .join('  |  ')

  return [
    '=== PIPELINE OVERVIEW ===',
    `Active clients: ${agg.totalActive}  |  ${byStage}`,
    `Weighted pipeline value: ${agg.weightedPipelineValueFormatted}`,
    `Overdue follow-ups: ${agg.overdueFollowUpCount}  |  Going cold (30+ days): ${agg.staleClientCount}`,
    '=== END PIPELINE OVERVIEW ===',
  ].join('\n')
}

/**
 * Assemble the final {{context_block}} string from budgeted items.
 * Groups items by type with section headers for readability.
 */
export function buildContextBlock(
  included: IncludedItem[],
  aggregate?: PipelineAggregate,
): string {
  const sections: string[] = []

  if (aggregate) {
    sections.push(aggregateHeader(aggregate))
  }

  const byType = new Map<string, IncludedItem[]>()
  for (const item of included) {
    const group = byType.get(item.type) ?? []
    group.push(item)
    byType.set(item.type, group)
  }

  const order = ['client', 'project', 'note', 'task', 'activity'] as const
  for (const type of order) {
    const items = byType.get(type)
    if (!items || items.length === 0) continue
    sections.push(items.map((i) => i.content).join('\n\n'))
  }

  return sections.join('\n\n')
}

// ─── Full item-set builder (used by pipeline) ─────────────────────────────────

export interface ScorableSet {
  items: ScorableItem[]
  clientMap: Map<string, EngineClient>
  noteMap: Map<string, EngineNote>
  taskMap: Map<string, EngineTask>
  activityMap: Map<string, EngineActivity>
}

export function buildScorableSet(
  clients: EngineClient[],
  notes: EngineNote[],
  tasks: EngineTask[],
  activities: EngineActivity[],
): ScorableSet {
  const clientMap = new Map(clients.map((c) => [c.id, c]))
  const noteMap = new Map(notes.map((n) => [n.id, n]))
  const taskMap = new Map(tasks.map((t) => [t.id, t]))
  const activityMap = new Map(activities.map((a) => [a.id, a]))

  const items: ScorableItem[] = [
    ...clients.map((c) => toScorableClient(c)),
    ...notes.map((n) => toScorableNote(n, clientMap)),
    ...tasks.map((t) => toScorableTask(t, clientMap)),
    ...activities.map((a) => toScorableActivity(a, clientMap)),
  ]

  return { items, clientMap, noteMap, taskMap, activityMap }
}

export function buildScoredItemsFromResults(
  results: Array<{ item: ScorableItem; breakdown: ScoreBreakdown }>,
  clientMap: Map<string, EngineClient>,
  noteMap: Map<string, EngineNote>,
  taskMap: Map<string, EngineTask>,
  activityMap: Map<string, EngineActivity>,
  now: Date,
): ScoredItem[] {
  return results.map(({ item, breakdown }) => {
    switch (item.kind) {
      case 'client': {
        const c = clientMap.get(item.id)
        if (!c) throw new Error(`Client ${item.id} not in map`)
        return toScoredClient(c, breakdown)
      }
      case 'note': {
        const n = noteMap.get(item.id)
        if (!n) throw new Error(`Note ${item.id} not in map`)
        return toScoredNote(n, breakdown)
      }
      case 'task': {
        const t = taskMap.get(item.id)
        if (!t) throw new Error(`Task ${item.id} not in map`)
        return toScoredTask(t, breakdown, now)
      }
      case 'activity': {
        const a = activityMap.get(item.id)
        if (!a) throw new Error(`Activity ${item.id} not in map`)
        return toScoredActivity(a, breakdown)
      }
    }
  })
}
