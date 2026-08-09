import { describe, it, expect } from 'vitest'
import { scoreItem, scoreAll } from '../scorer'
import type { ScorableClient, ScorableNote, ScorableTask } from '../types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-06-03T12:00:00Z')

const daysAgo = (n: number): string =>
  new Date(NOW.getTime() - n * 86_400_000).toISOString()

const daysFromNow = (n: number): string =>
  new Date(NOW.getTime() + n * 86_400_000).toISOString()

const proposalOutClient: ScorableClient = {
  kind: 'client',
  id: 'c1',
  stage: 'proposal_out',
  estimatedValue: 10_000,
  lastContactDate: daysAgo(5),
  nextFollowupDate: daysFromNow(3),
  updatedAt: daysAgo(2),
  searchText: 'Acme Corp web development project proposal outstanding',
}

const staleLeadClient: ScorableClient = {
  kind: 'client',
  id: 'c2',
  stage: 'lead',
  estimatedValue: 500,
  lastContactDate: daysAgo(60),
  nextFollowupDate: daysAgo(30), // overdue
  updatedAt: daysAgo(60),
  searchText: 'Old Lead design work',
}

const freshLeadClient: ScorableClient = {
  kind: 'client',
  id: 'c3',
  stage: 'lead',
  estimatedValue: 1_000,
  lastContactDate: daysAgo(2),
  nextFollowupDate: daysFromNow(5),
  updatedAt: daysAgo(2),
  searchText: 'Fresh lead consulting',
}

const recentNote: ScorableNote = {
  kind: 'note',
  id: 'n1',
  clientStage: 'proposal_out',
  clientEstimatedValue: 10_000,
  occurredAt: daysAgo(1),
  searchText: 'Had a great call about the contract terms and timeline',
}

const oldNote: ScorableNote = {
  kind: 'note',
  id: 'n2',
  clientStage: 'lead',
  clientEstimatedValue: 500,
  occurredAt: daysAgo(70),
  searchText: 'Initial outreach sent no response',
}

const overdueTask: ScorableTask = {
  kind: 'task',
  id: 't1',
  clientStage: 'active',
  clientEstimatedValue: 5_000,
  dueDate: daysAgo(7),
  isDone: false,
  searchText: 'Send revised proposal follow up',
}

const doneTask: ScorableTask = {
  kind: 'task',
  id: 't2',
  clientStage: 'past',
  clientEstimatedValue: 3_000,
  dueDate: daysAgo(3),
  isDone: true,
  searchText: 'Send invoice final payment',
}

// ─── scoreItem ────────────────────────────────────────────────────────────────

describe('scoreItem — composite bounds', () => {
  it('composite is between 0 and 1', () => {
    const result = scoreItem(proposalOutClient, 'grow revenue', {}, 10_000, NOW)
    expect(result.composite).toBeGreaterThanOrEqual(0)
    expect(result.composite).toBeLessThanOrEqual(1)
  })

  it('all sub-scores are between 0 and 1', () => {
    const result = scoreItem(proposalOutClient, 'convert leads', {}, 10_000, NOW)
    expect(result.recency).toBeGreaterThanOrEqual(0)
    expect(result.recency).toBeLessThanOrEqual(1)
    expect(result.dealValue).toBeGreaterThanOrEqual(0)
    expect(result.dealValue).toBeLessThanOrEqual(1)
    expect(result.stageUrgency).toBeGreaterThanOrEqual(0)
    expect(result.stageUrgency).toBeLessThanOrEqual(1)
    expect(result.stalenessRisk).toBeGreaterThanOrEqual(0)
    expect(result.stalenessRisk).toBeLessThanOrEqual(1)
    expect(result.relevance).toBeGreaterThanOrEqual(0)
    expect(result.relevance).toBeLessThanOrEqual(1)
  })
})

describe('scoreItem — stage urgency', () => {
  it('a client with a proposal out scores higher stageUrgency than a lead', () => {
    const n = scoreItem(proposalOutClient, '', {}, 10_000, NOW)
    const l = scoreItem(freshLeadClient, '', {}, 10_000, NOW)
    expect(n.stageUrgency).toBeGreaterThan(l.stageUrgency)
  })

  it('proposal-out stageUrgency is 1.0, lead is 0.25', () => {
    const n = scoreItem(proposalOutClient, '', {}, 10_000, NOW)
    const l = scoreItem(freshLeadClient, '', {}, 10_000, NOW)
    expect(n.stageUrgency).toBe(1.0)
    expect(l.stageUrgency).toBe(0.25)
  })

  it('past and archived clients have stageUrgency of 0', () => {
    // Nothing outstanding to chase either way: the work is finished, or the
    // relationship is over.
    for (const stage of ['past', 'lost'] as const) {
      const closed: ScorableClient = { ...proposalOutClient, id: `c-${stage}`, stage }
      expect(scoreItem(closed, '', {}, 10_000, NOW).stageUrgency).toBe(0)
    }
  })
})

describe('scoreItem — recency decay', () => {
  it('item updated today scores higher recency than one updated 60 days ago', () => {
    const fresh = scoreItem(freshLeadClient, '', {}, 10_000, NOW)
    const old = scoreItem(staleLeadClient, '', {}, 10_000, NOW)
    expect(fresh.recency).toBeGreaterThan(old.recency)
  })

  it('note from yesterday scores higher recency than note from 70 days ago', () => {
    const recent = scoreItem(recentNote, '', {}, 10_000, NOW)
    const old = scoreItem(oldNote, '', {}, 10_000, NOW)
    expect(recent.recency).toBeGreaterThan(old.recency)
  })

  it('recency at day 0 is ~1.0', () => {
    const client: ScorableClient = {
      ...proposalOutClient,
      updatedAt: NOW.toISOString(),
    }
    const result = scoreItem(client, '', {}, 10_000, NOW)
    expect(result.recency).toBeCloseTo(1.0, 2)
  })

  it('recency at 30 days is ~1/e (~0.37)', () => {
    const client: ScorableClient = {
      ...proposalOutClient,
      updatedAt: daysAgo(30),
    }
    const result = scoreItem(client, '', {}, 10_000, NOW)
    expect(result.recency).toBeCloseTo(Math.exp(-1), 2)
  })
})

describe('scoreItem — deal value', () => {
  it('high-value client scores higher dealValue than low-value', () => {
    const high = scoreItem(proposalOutClient, '', {}, 10_000, NOW)
    const low = scoreItem(freshLeadClient, '', {}, 10_000, NOW)
    expect(high.dealValue).toBeGreaterThan(low.dealValue)
  })

  it('dealValue is 1.0 for the max-value item', () => {
    const result = scoreItem(proposalOutClient, '', {}, 10_000, NOW)
    expect(result.dealValue).toBe(1.0)
  })

  it('null estimatedValue yields dealValue of 0', () => {
    const noValue: ScorableClient = {
      ...proposalOutClient,
      id: 'cn',
      estimatedValue: null,
    }
    expect(scoreItem(noValue, '', {}, 10_000, NOW).dealValue).toBe(0)
  })
})

describe('scoreItem — staleness risk', () => {
  it('overdue follow-up yields stalenessRisk of 1.0', () => {
    const result = scoreItem(staleLeadClient, '', {}, 10_000, NOW)
    expect(result.stalenessRisk).toBe(1.0)
  })

  it('recently-contacted client with future follow-up has lower stalenessRisk', () => {
    const fresh = scoreItem(freshLeadClient, '', {}, 10_000, NOW)
    const stale = scoreItem(staleLeadClient, '', {}, 10_000, NOW)
    expect(fresh.stalenessRisk).toBeLessThan(stale.stalenessRisk)
  })

  it('overdue task gets stalenessRisk of 1.0', () => {
    const result = scoreItem(overdueTask, '', {}, 10_000, NOW)
    expect(result.stalenessRisk).toBe(1.0)
  })

  it('completed task has stalenessRisk of 0', () => {
    expect(scoreItem(doneTask, '', {}, 10_000, NOW).stalenessRisk).toBe(0)
  })
})

describe('scoreItem — keyword relevance', () => {
  it('objective containing words from searchText boosts relevance', () => {
    const withObjective = scoreItem(
      proposalOutClient,
      'web development proposal',
      {},
      10_000,
      NOW,
    )
    const withoutObjective = scoreItem(proposalOutClient, '', {}, 10_000, NOW)
    expect(withObjective.relevance).toBeGreaterThan(withoutObjective.relevance)
  })

  it('completely unrelated objective yields near-zero relevance', () => {
    const result = scoreItem(
      proposalOutClient,
      'restaurant menu pricing',
      {},
      10_000,
      NOW,
    )
    expect(result.relevance).toBeLessThan(0.1)
  })

  it('relevance is symmetric to word overlap', () => {
    const result = scoreItem(
      { ...proposalOutClient, searchText: 'convert leads pipeline' },
      'convert leads',
      {},
      10_000,
      NOW,
    )
    expect(result.relevance).toBeGreaterThan(0.3)
  })
})

describe('scoreItem — weight overrides', () => {
  it('zeroing dealValue does not change stageUrgency or recency contributions', () => {
    const normal = scoreItem(proposalOutClient, '', {}, 10_000, NOW)
    const noDealValue = scoreItem(
      proposalOutClient,
      '',
      { dealValue: 0 },
      10_000,
      NOW,
    )
    // stageUrgency and recency sub-scores are unchanged
    expect(noDealValue.stageUrgency).toBe(normal.stageUrgency)
    expect(noDealValue.recency).toBeCloseTo(normal.recency, 5)
  })

  it('maximising stageUrgency weight makes a proposal-out client rank much higher than a lead', () => {
    const neg = scoreItem(proposalOutClient, '', { stageUrgency: 1, recency: 0, dealValue: 0, stalenessRisk: 0, relevance: 0 }, 10_000, NOW)
    const lead = scoreItem(freshLeadClient, '', { stageUrgency: 1, recency: 0, dealValue: 0, stalenessRisk: 0, relevance: 0 }, 10_000, NOW)
    expect(neg.composite).toBeGreaterThan(lead.composite)
  })

  it('weights are normalised: partial override still sums to a valid composite', () => {
    // Supply weights that don't sum to 1 — result should still be in [0,1]
    const result = scoreItem(
      proposalOutClient,
      'convert',
      { recency: 2, dealValue: 3 },
      10_000,
      NOW,
    )
    expect(result.composite).toBeGreaterThanOrEqual(0)
    expect(result.composite).toBeLessThanOrEqual(1)
  })
})

// ─── scoreAll ─────────────────────────────────────────────────────────────────

describe('scoreAll — ranking', () => {
  it('a high-value client with a proposal out ranks above a stale low-value lead', () => {
    const results = scoreAll(
      [staleLeadClient, proposalOutClient],
      'grow revenue',
      {},
      NOW,
    )
    expect(results[0].item.id).toBe('c1') // proposal out
    expect(results[1].item.id).toBe('c2') // stale lead
  })

  it('recent note ranks above old note', () => {
    const results = scoreAll([oldNote, recentNote], 'client update', {}, NOW)
    expect(results[0].item.id).toBe('n1')
    expect(results[1].item.id).toBe('n2')
  })

  it('overdue task ranks above a completed task', () => {
    const results = scoreAll([doneTask, overdueTask], '', {}, NOW)
    expect(results[0].item.id).toBe('t1')
  })

  it('objective keyword "convert leads" boosts leads relative to finished clients', () => {
    // Equal value and recency — only stageUrgency and keyword relevance differ.
    const baseDate = daysAgo(5)
    const pastClient: ScorableClient = {
      kind: 'client',
      id: 'cw',
      stage: 'past',
      estimatedValue: 5_000,
      lastContactDate: baseDate,
      nextFollowupDate: daysFromNow(10),
      updatedAt: baseDate,
      searchText: 'past client closed deal payment received',
    }
    const leadClient: ScorableClient = {
      kind: 'client',
      id: 'cl',
      stage: 'lead',
      estimatedValue: 5_000,
      lastContactDate: baseDate,
      nextFollowupDate: daysFromNow(10),
      updatedAt: baseDate,
      searchText: 'convert leads pipeline potential prospect',
    }
    const results = scoreAll([pastClient, leadClient], 'convert leads', {}, NOW)
    // Past: stageUrgency=0, relevance≈0. Lead: stageUrgency=0.25, relevance>0.
    const pastScore = results.find((r) => r.item.id === 'cw')!.breakdown.composite
    const leadScore = results.find((r) => r.item.id === 'cl')!.breakdown.composite
    expect(leadScore).toBeGreaterThan(pastScore)
  })

  it('returns items sorted descending by composite', () => {
    const results = scoreAll(
      [staleLeadClient, freshLeadClient, proposalOutClient],
      '',
      {},
      NOW,
    )
    for (let i = 0; i < results.length - 1; i++) {
      expect(results[i].breakdown.composite).toBeGreaterThanOrEqual(
        results[i + 1].breakdown.composite,
      )
    }
  })

  it('maxValue is computed from the batch — dealValue is relative', () => {
    const results = scoreAll(
      [proposalOutClient, freshLeadClient],
      '',
      {},
      NOW,
    )
    const negBreakdown = results.find((r) => r.item.id === 'c1')!.breakdown
    expect(negBreakdown.dealValue).toBe(1.0) // 10_000 / 10_000
  })

  it('handles an empty items array without throwing', () => {
    expect(() => scoreAll([], 'anything', {}, NOW)).not.toThrow()
    expect(scoreAll([], 'anything', {}, NOW)).toHaveLength(0)
  })
})

// ─── Reason strings ───────────────────────────────────────────────────────────

describe('scoreItem — reason strings', () => {
  it('a high-value recent client with a proposal out produces a non-empty reason', () => {
    const result = scoreItem(proposalOutClient, '', {}, 10_000, NOW)
    expect(result.reason.length).toBeGreaterThan(0)
  })

  it('overdue follow-up appears in the reason', () => {
    const result = scoreItem(staleLeadClient, '', {}, 10_000, NOW)
    expect(result.reason).toContain('overdue follow-up')
  })

  it('"proposal out" label appears when the client has a proposal outstanding', () => {
    const result = scoreItem(proposalOutClient, '', {}, 10_000, NOW)
    expect(result.reason).toContain('proposal out')
  })

  it('"high value" appears when item is at max deal value', () => {
    const result = scoreItem(proposalOutClient, '', {}, 10_000, NOW)
    expect(result.reason).toContain('high value')
  })

  it('"keyword match" appears when objective overlaps with searchText', () => {
    const result = scoreItem(
      { ...proposalOutClient, searchText: 'convert leads proposal' },
      'convert leads',
      {},
      10_000,
      NOW,
    )
    expect(result.reason).toContain('keyword match')
  })

  it('reason is always a non-empty string even for low-scoring items', () => {
    const lowItem: ScorableClient = {
      kind: 'client',
      id: 'low',
      stage: 'lost',
      estimatedValue: 0,
      lastContactDate: daysAgo(5),
      nextFollowupDate: daysFromNow(10),
      updatedAt: daysAgo(5),
      searchText: 'nothing relevant',
    }
    const result = scoreItem(lowItem, 'unrelated objective', {}, 10_000, NOW)
    expect(typeof result.reason).toBe('string')
    expect(result.reason.length).toBeGreaterThan(0)
  })
})
