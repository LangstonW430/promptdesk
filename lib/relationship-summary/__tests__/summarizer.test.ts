import { describe, it, expect } from 'vitest'
import { buildRelationshipSummary } from '../index'
import type { SummaryInput, SummaryNote, StatusTransition } from '../index'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-06-03T12:00:00Z')

const daysAgo = (n: number): Date =>
  new Date(NOW.getTime() - n * 86_400_000)

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildRelationshipSummary', () => {
  it('handles zero notes gracefully', () => {
    const input: SummaryInput = {
      client: { status: 'lead', createdAt: daysAgo(30) },
      notes: [],
      statusHistory: [],
    }
    const result = buildRelationshipSummary(input, NOW)

    expect(result).toContain('=== RELATIONSHIP SUMMARY ===')
    expect(result).toContain('=== END RELATIONSHIP SUMMARY ===')
    expect(result).toContain('0 notes')
    expect(result).toContain('Current status: lead')
    expect(result).toContain('Status path: lead')
    // No sections that need data
    expect(result).not.toContain('KEY FACTS')
    expect(result).not.toContain('RECENT')
  })

  it('computes age correctly — months for older clients', () => {
    const input: SummaryInput = {
      client: { status: 'negotiating', createdAt: daysAgo(14 * 30) },
      notes: [],
      statusHistory: [],
    }
    const result = buildRelationshipSummary(input, NOW)
    expect(result).toMatch(/Active 1[34] months/)
  })

  it('computes age correctly — days for brand-new clients', () => {
    const input: SummaryInput = {
      client: { status: 'lead', createdAt: daysAgo(3) },
      notes: [],
      statusHistory: [],
    }
    const result = buildRelationshipSummary(input, NOW)
    expect(result).toMatch(/Active 3 days/)
  })

  it('builds status path from history', () => {
    const history: StatusTransition[] = [
      { from: 'lead', to: 'contacted', occurredAt: daysAgo(120) },
      { from: 'contacted', to: 'proposal_sent', occurredAt: daysAgo(60) },
      { from: 'proposal_sent', to: 'negotiating', occurredAt: daysAgo(20) },
    ]
    const input: SummaryInput = {
      client: { status: 'negotiating', createdAt: daysAgo(180) },
      notes: [],
      statusHistory: history,
    }
    const result = buildRelationshipSummary(input, NOW)
    expect(result).toContain('Status path:')
    expect(result).toContain('lead →')
    expect(result).toContain('contacted')
    expect(result).toContain('negotiating')
  })

  it('caps status path at 5 path nodes (4 transitions)', () => {
    // 5 transitions — should keep only last 4
    const history: StatusTransition[] = [
      { from: 'lead', to: 'contacted', occurredAt: daysAgo(200) },
      { from: 'contacted', to: 'proposal_sent', occurredAt: daysAgo(160) },
      { from: 'proposal_sent', to: 'negotiating', occurredAt: daysAgo(120) },
      { from: 'negotiating', to: 'won', occurredAt: daysAgo(80) },
      { from: 'won', to: 'lead', occurredAt: daysAgo(40) },
    ]
    const input: SummaryInput = {
      client: { status: 'lead', createdAt: daysAgo(210) },
      notes: [],
      statusHistory: history,
    }
    const result = buildRelationshipSummary(input, NOW)
    // Should not include the very first transition's origin (lead from 200 days ago)
    // because only last 4 transitions are kept
    const path = result.split('\n').find((l) => l.startsWith('Status path:')) ?? ''
    // 5-node path = initial + 4 arrows; 6-node would be initial + 5 arrows
    const arrows = (path.match(/→/g) ?? []).length
    expect(arrows).toBeLessThanOrEqual(4)
  })

  it('extracts key facts from sentences containing trigger keywords', () => {
    const notes: SummaryNote[] = [
      {
        body: 'We discussed the budget and they mentioned it is around $10k. The scope looks flexible.',
        noteType: 'meeting',
        occurredAt: daysAgo(10),
      },
      {
        body: 'Nice weather today. Nothing notable happened.',
        noteType: 'note',
        occurredAt: daysAgo(5),
      },
    ]
    const input: SummaryInput = {
      client: { status: 'proposal_sent', createdAt: daysAgo(60) },
      notes,
      statusHistory: [],
    }
    const result = buildRelationshipSummary(input, NOW)
    expect(result).toContain('KEY FACTS')
    // Budget sentence should appear in KEY FACTS; filler note should NOT be promoted there
    expect(result).toContain('budget')
    const keyFactsIdx = result.indexOf('KEY FACTS')
    const recentIdx = result.indexOf('RECENT')
    const keyFactsBlock = result.slice(keyFactsIdx, recentIdx === -1 ? undefined : recentIdx)
    expect(keyFactsBlock).not.toContain('Nice weather')
  })

  it('deduplicates nearly identical facts', () => {
    // Two sentences with high word overlap (Jaccard ≥ 0.5)
    const notes: SummaryNote[] = [
      {
        // Sentences share "Budget", "approved", "Q2", "project", "confirmed" — Jaccard well above 0.5
        body: 'Budget approved for the Q2 project scope. Budget approved for Q2 project scope confirmed.',
        noteType: 'note',
        occurredAt: daysAgo(5),
      },
    ]
    const input: SummaryInput = {
      client: { status: 'negotiating', createdAt: daysAgo(30) },
      notes,
      statusHistory: [],
    }
    const result = buildRelationshipSummary(input, NOW)
    // Near-duplicate sentences should produce at most 1 KEY FACTS line
    const factLines = result
      .split('\n')
      .filter((l) => l.startsWith('"') && l.toLowerCase().includes('budget'))
    expect(factLines.length).toBe(1)
  })

  it('shows recent notes from last 90 days only', () => {
    const notes: SummaryNote[] = [
      { body: 'Old note from long ago.', noteType: 'note', occurredAt: daysAgo(120) },
      { body: 'Recent call summary.', noteType: 'call', occurredAt: daysAgo(15) },
    ]
    const input: SummaryInput = {
      client: { status: 'contacted', createdAt: daysAgo(200) },
      notes,
      statusHistory: [],
    }
    const result = buildRelationshipSummary(input, NOW)
    expect(result).toContain('RECENT (last 90 days)')
    expect(result).toContain('Recent call summary')
    expect(result).not.toContain('Old note from long ago')
  })

  it('omits RECENT section when all notes are older than 90 days', () => {
    const notes: SummaryNote[] = [
      { body: 'Very old meeting notes.', noteType: 'meeting', occurredAt: daysAgo(100) },
      { body: 'Even older note.', noteType: 'note', occurredAt: daysAgo(150) },
    ]
    const input: SummaryInput = {
      client: { status: 'lead', createdAt: daysAgo(200) },
      notes,
      statusHistory: [],
    }
    const result = buildRelationshipSummary(input, NOW)
    expect(result).not.toContain('RECENT')
  })

  it('shows open tasks line with overdue count', () => {
    const input: SummaryInput = {
      client: { status: 'negotiating', createdAt: daysAgo(60) },
      notes: [],
      statusHistory: [],
      openTaskCount: 3,
      overdueTaskCount: 1,
    }
    const result = buildRelationshipSummary(input, NOW)
    expect(result).toContain('3 open tasks')
    expect(result).toContain('1 overdue')
  })

  it('omits tasks line when there are no open tasks', () => {
    const input: SummaryInput = {
      client: { status: 'won', createdAt: daysAgo(60) },
      notes: [],
      statusHistory: [],
      openTaskCount: 0,
      overdueTaskCount: 0,
    }
    const result = buildRelationshipSummary(input, NOW)
    expect(result).not.toContain('open task')
  })

  it('stays within token budget (~1,400 chars) for a heavy client', () => {
    // 15 notes with long bodies, 5 status transitions
    const longNote = (i: number, daysBack: number): SummaryNote => ({
      body: `Meeting note ${i}: The client confirmed the budget for the project and we discussed the timeline in detail. They have concerns about the scope and mentioned the deadline is Q3. Contract review is pending. They want to confirm pricing before signing. The decision maker will be out next week.`,
      noteType: 'meeting',
      occurredAt: daysAgo(daysBack),
    })

    const notes = Array.from({ length: 15 }, (_, i) => longNote(i, i * 8 + 2))

    const history: StatusTransition[] = [
      { from: 'lead', to: 'contacted', occurredAt: daysAgo(110) },
      { from: 'contacted', to: 'proposal_sent', occurredAt: daysAgo(80) },
      { from: 'proposal_sent', to: 'negotiating', occurredAt: daysAgo(50) },
    ]

    const input: SummaryInput = {
      client: { status: 'negotiating', createdAt: daysAgo(120) },
      notes,
      statusHistory: history,
      openTaskCount: 4,
      overdueTaskCount: 2,
    }

    const result = buildRelationshipSummary(input, NOW)
    expect(result.length).toBeLessThanOrEqual(1_400)
    expect(result).toContain('=== RELATIONSHIP SUMMARY ===')
    expect(result).toContain('=== END RELATIONSHIP SUMMARY ===')
  })

  it('caps RECENT section to 3 notes', () => {
    const notes: SummaryNote[] = Array.from({ length: 6 }, (_, i) => ({
      body: `Recent note number ${i + 1} with some content here.`,
      noteType: 'note',
      occurredAt: daysAgo(i + 1),
    }))
    const input: SummaryInput = {
      client: { status: 'contacted', createdAt: daysAgo(30) },
      notes,
      statusHistory: [],
    }
    const result = buildRelationshipSummary(input, NOW)
    // Count lines starting with "Jun" or "May" under RECENT section
    const recentIdx = result.indexOf('RECENT (last 90 days)')
    const endIdx = result.indexOf('\n\n', recentIdx)
    const recentBlock = result.slice(recentIdx, endIdx === -1 ? undefined : endIdx)
    const recentLines = recentBlock.split('\n').filter((l) => l.match(/^[A-Z][a-z]{2} \d/))
    expect(recentLines.length).toBeLessThanOrEqual(3)
  })
})
