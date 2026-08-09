/**
 * Pure, deterministic relationship summary builder.
 * No I/O — pass data in, get a plain-text string out.
 * Target: ~250–350 tokens (~1,000–1,400 chars).
 */

import { CLIENT_STAGE_LABELS, type ClientStage } from '@/lib/clients/stage'

/**
 * A historical stage move, read from `status_changed` activity rows. Clients no
 * longer carry a status anyone can set, so nothing new is recorded here — but
 * the transitions logged before the change are still real history and the
 * strings use the vocabulary of their time.
 */
export interface StatusTransition {
  from: string
  to: string
  occurredAt: Date | string
}

export interface SummaryNote {
  body: string
  noteType: string
  occurredAt: Date | string
}

export interface SummaryInput {
  client: {
    /** Derived from the client's projects — see lib/clients/stage.ts. */
    stage: ClientStage
    createdAt: Date | string
  }
  notes: SummaryNote[]
  statusHistory: StatusTransition[]
  openTaskCount?: number
  overdueTaskCount?: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDate(val: Date | string): Date {
  return val instanceof Date ? val : new Date(val as string)
}

function monthYear(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function shortDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 86_400_000
}

function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  const cut = text.slice(0, maxLen)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut) + '…'
}

// ─── Stage path ───────────────────────────────────────────────────────────────

function buildStagePath(currentStage: ClientStage, history: StatusTransition[]): string {
  const current = CLIENT_STAGE_LABELS[currentStage]
  if (history.length === 0) return current

  const sorted = [...history]
    .sort((a, b) => toDate(a.occurredAt).getTime() - toDate(b.occurredAt).getTime())
    .slice(-4) // keep at most 4 transitions (5 path nodes total)

  const parts: string[] = [sorted[0].from]
  for (const t of sorted) {
    parts.push(`${t.to} (${monthYear(toDate(t.occurredAt))})`)
  }

  // Append the current stage if it diverged from the last recorded transition
  if (sorted[sorted.length - 1].to !== currentStage) {
    parts.push(current)
  }

  return parts.join(' → ')
}

// ─── Key-fact extraction ──────────────────────────────────────────────────────

// Keywords that signal high-value information worth surfacing.
const TRIGGER_KEYWORDS = [
  'budget', 'contract', 'deadline', 'timeline', 'proposal', 'pricing',
  'decision', 'scope', 'concern', 'urgent', 'approved', 'declined',
  'signed', 'retainer', 'invoice', 'payment', 'blocked', 'interested',
  'committed', 'confirmed', 'milestone', 'objection', 'follow',
]

function wordSet(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean))
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1
  let intersection = 0
  for (const w of a) if (b.has(w)) intersection++
  return intersection / (a.size + b.size - intersection)
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/^["'\s–-]+|["'\s–-]+$/g, '').trim())
    .filter((s) => s.length >= 20 && s.length <= 300)
}

/**
 * Extract the top keyword-bearing sentences from all notes.
 *
 * FUTURE — pgvector slot: replace the keyword-hit × recency scoring below with
 * ANN (approximate nearest-neighbour) search against an objective embedding.
 * Store note embeddings in `notes.embedding vector(1536)` with an HNSW index.
 * Query: SELECT id FROM notes WHERE client_id = $1
 *        ORDER BY embedding <=> $objective_vec LIMIT 10
 * This function's input/output contract stays the same; only the inner scoring
 * loop changes — swap TRIGGER_KEYWORDS hits for cosine-similarity scores.
 */
function extractKeyFacts(notes: SummaryNote[], now: Date, maxFacts = 4): string[] {
  interface Candidate {
    sentence: string
    score: number
    label: string // "Month Year"
  }

  const candidates: Candidate[] = []

  for (const note of notes) {
    const date = toDate(note.occurredAt)
    const daysSince = daysBetween(date, now)
    // Recency weight: full weight within 30 days, decaying to ~0.05 at 90 days
    const recency = Math.exp(-daysSince / 90)

    for (const sentence of splitSentences(note.body)) {
      const lower = sentence.toLowerCase()
      const hits = TRIGGER_KEYWORDS.filter((k) => lower.includes(k)).length
      if (hits === 0) continue
      const score = hits * (1 + recency)
      candidates.push({ sentence, score, label: monthYear(date) })
    }
  }

  candidates.sort((a, b) => b.score - a.score)

  const selected: Candidate[] = []
  for (const c of candidates) {
    if (selected.length >= maxFacts) break
    const isDup = selected.some(
      (s) => jaccard(wordSet(s.sentence), wordSet(c.sentence)) >= 0.5,
    )
    if (!isDup) selected.push(c)
  }

  return selected.map((c) => `"${truncateAtWord(c.sentence, 120)}" (${c.label})`)
}

// ─── Public builder ───────────────────────────────────────────────────────────

export function buildRelationshipSummary(
  input: SummaryInput,
  now: Date = new Date(),
): string {
  const {
    client,
    notes,
    statusHistory,
    openTaskCount = 0,
    overdueTaskCount = 0,
  } = input

  const createdAt = toDate(client.createdAt)
  const totalDays = daysBetween(createdAt, now)
  const months = Math.round(totalDays / 30)
  const agePart =
    months >= 2
      ? `${months} months`
      : `${Math.max(1, Math.round(totalDays))} day${Math.round(totalDays) === 1 ? '' : 's'}`

  const lines: string[] = []

  // ── Relationship header ──
  lines.push(
    `Active ${agePart} | ${notes.length} note${notes.length === 1 ? '' : 's'} | Current stage: ${CLIENT_STAGE_LABELS[client.stage]}`,
  )

  // ── Stage path ──
  lines.push(`Stage path: ${buildStagePath(client.stage, statusHistory)}`)

  // ── Key facts ──
  const keyFacts = extractKeyFacts(notes, now)
  if (keyFacts.length > 0) {
    lines.push('')
    lines.push('KEY FACTS')
    for (const fact of keyFacts) lines.push(fact)
  }

  // ── Recent notes (last 90 days) ──
  const cutoff = new Date(now.getTime() - 90 * 86_400_000)
  const recentNotes = notes
    .filter((n) => toDate(n.occurredAt) >= cutoff)
    .sort((a, b) => toDate(b.occurredAt).getTime() - toDate(a.occurredAt).getTime())
    .slice(0, 3)

  if (recentNotes.length > 0) {
    lines.push('')
    lines.push('RECENT (last 90 days)')
    for (const n of recentNotes) {
      const d = toDate(n.occurredAt)
      lines.push(`${shortDate(d)} ${n.noteType}: ${truncateAtWord(n.body, 100)}`)
    }
  }

  // ── Tasks ──
  if (openTaskCount > 0) {
    const overdueStr = overdueTaskCount > 0 ? ` | ${overdueTaskCount} overdue` : ''
    lines.push('')
    lines.push(`${openTaskCount} open task${openTaskCount === 1 ? '' : 's'}${overdueStr}`)
  }

  const body = lines.join('\n')
  return `=== RELATIONSHIP SUMMARY ===\n${body}\n=== END RELATIONSHIP SUMMARY ===`
}
