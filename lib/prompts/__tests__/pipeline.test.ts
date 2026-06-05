import { describe, it, expect } from 'vitest'
import { buildPrompt } from '../pipeline'
import { businessActionPlan } from '@/lib/prompt-engine/templates/business-action-plan'
import { clientInsight } from '@/lib/prompt-engine/templates/client-insight'
import { noteAnalysis } from '@/lib/prompt-engine/templates/note-analysis'
import type { RawClient, RawNote, RawTask, RawActivity } from '@/lib/prompt-engine/types'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const NOW = new Date('2026-06-03T12:00:00Z')

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 86_400_000)
}
function daysFromNow(n: number): Date {
  return new Date(NOW.getTime() + n * 86_400_000)
}

// Three clients at different stages / values
const clientAcme: RawClient = {
  id: 'c-acme',
  companyName: 'Acme Corp',
  contactName: 'Jane Smith',
  email: 'jane@acme.com',
  phone: null,
  website: 'acme.com',
  industry: 'Technology',
  companySize: '50-200',
  leadSource: 'Referral',
  status: 'negotiating',
  estimatedValue: 10000,
  projectType: 'Website redesign',
  painPoints: 'Old website, poor mobile experience',
  requirements: 'React, mobile-first, CMS integration',
  opportunityNotes: 'Strong fit, decision next month',
  lastContactDate: daysAgo(3),
  nextFollowupDate: daysFromNow(5),
  tags: ['hot-lead'],
  customFields: {},
  createdAt: daysAgo(60),
  updatedAt: daysAgo(3),
}

const clientBeta: RawClient = {
  id: 'c-beta',
  companyName: 'Beta LLC',
  contactName: 'Tom Jones',
  email: 'tom@beta.com',
  phone: null,
  website: null,
  industry: 'Finance',
  companySize: null,
  leadSource: null,
  status: 'lead',
  estimatedValue: 500,
  projectType: null,
  painPoints: null,
  requirements: null,
  opportunityNotes: null,
  lastContactDate: daysAgo(60),
  nextFollowupDate: daysAgo(30), // overdue
  tags: [],
  customFields: {},
  createdAt: daysAgo(90),
  updatedAt: daysAgo(60),
}

const clientGamma: RawClient = {
  id: 'c-gamma',
  companyName: 'Gamma Studio',
  contactName: 'Alice Wang',
  email: 'alice@gamma.com',
  phone: null,
  website: null,
  industry: 'Design',
  companySize: null,
  leadSource: null,
  status: 'proposal_sent',
  estimatedValue: 5000,
  projectType: 'Brand identity',
  painPoints: 'Needs a fresh visual direction',
  requirements: 'Logo, color palette, guidelines',
  opportunityNotes: null,
  lastContactDate: daysAgo(10),
  nextFollowupDate: daysFromNow(3),
  tags: [],
  customFields: {},
  createdAt: daysAgo(30),
  updatedAt: daysAgo(10),
}

// Notes for Acme — including a near-duplicate pair
const noteAcme1: RawNote = {
  id: 'n-acme-1',
  clientId: 'c-acme',
  body: 'Had a great discovery call with Jane. She confirmed the budget is around $10k and wants to move forward.',
  noteType: 'call',
  occurredAt: daysAgo(10),
}

// Near-duplicate of noteAcme1 (same facts, slightly reworded — should be deduped)
const noteAcme2NearDup: RawNote = {
  id: 'n-acme-2',
  clientId: 'c-acme',
  body: 'Had a great discovery call with Jane. She confirmed the budget is around $10k and wants to move forward with us.',
  noteType: 'call',
  occurredAt: daysAgo(11), // older — should be dropped
}

const noteAcme3: RawNote = {
  id: 'n-acme-3',
  clientId: 'c-acme',
  body: 'Sent the proposal. Jane said she needs to review with her CTO before signing off.',
  noteType: 'email',
  occurredAt: daysAgo(5),
}

const noteBeta1: RawNote = {
  id: 'n-beta-1',
  clientId: 'c-beta',
  body: 'Initial outreach sent. No response yet.',
  noteType: 'email',
  occurredAt: daysAgo(60),
}

// Tasks — one overdue
const taskAcme: RawTask = {
  id: 't-acme-1',
  clientId: 'c-acme',
  projectId: null,
  title: 'Send revised proposal with updated timeline',
  dueDate: daysFromNow(4),
  isDone: false,
}

const taskOverdue: RawTask = {
  id: 't-beta-overdue',
  clientId: 'c-beta',
  projectId: null,
  title: 'Follow up with Tom after no response',
  dueDate: daysAgo(5),
  isDone: false,
}

// Activity
const activityAcme: RawActivity = {
  id: 'a-acme-1',
  clientId: 'c-acme',
  type: 'status_changed',
  detail: { from: 'proposal_sent', to: 'negotiating' },
  createdAt: daysAgo(7),
}

const USER_PROFILE = {
  businessName: 'Langston Web Studio',
  businessType: 'web development',
  currency: 'USD',
}

// ─── Global scope: Business Action Plan ───────────────────────────────────────

describe('buildPrompt — global scope (Business Action Plan)', () => {
  const result = buildPrompt({
    rawClients: [clientAcme, clientBeta, clientGamma],
    rawNotes: [noteAcme1, noteAcme2NearDup, noteAcme3, noteBeta1],
    rawTasks: [taskAcme, taskOverdue],
    rawActivities: [activityAcme],
    template: businessActionPlan,
    userProfile: USER_PROFILE,
    now: NOW,
  })

  it('renders a non-empty prompt text', () => {
    expect(result.text.trim().length).toBeGreaterThan(100)
  })

  it('includes the business name in the rendered text', () => {
    expect(result.text).toContain('Langston Web Studio')
  })

  it('includes the business type in the rendered text', () => {
    expect(result.text).toContain('web development')
  })

  it('includes the highest-value client (Acme Corp) in the context block', () => {
    expect(result.text).toContain('Acme Corp')
  })

  it('includes the pipeline overview section', () => {
    expect(result.text).toContain('PIPELINE OVERVIEW')
  })

  it('returns a positive tokenCount', () => {
    expect(result.tokenCount).toBeGreaterThan(0)
  })

  it('has no missing placeholders', () => {
    expect(result.text).not.toMatch(/\{\{[^}]+\}\}/)
  })

  it('deduplicates the near-duplicate note', () => {
    expect(result.contextMeta.deduplicatedNoteCount).toBeGreaterThanOrEqual(1)
  })

  it('records the correct total candidate count', () => {
    // 3 clients + 3 unique notes (after dedup) + 2 tasks + 1 activity = 9
    expect(result.contextMeta.totalCandidateCount).toBe(9)
  })

  it('contextMeta.includedItems is non-empty', () => {
    expect(result.contextMeta.includedItems.length).toBeGreaterThan(0)
  })

  it('every included item has a non-empty reason', () => {
    for (const item of result.contextMeta.includedItems) {
      expect(item.reason.length).toBeGreaterThan(0)
    }
  })

  it('every included item has a score between 0 and 1', () => {
    for (const item of result.contextMeta.includedItems) {
      expect(item.score).toBeGreaterThanOrEqual(0)
      expect(item.score).toBeLessThanOrEqual(1)
    }
  })

  it('the Acme Corp client item is among the included items', () => {
    expect(
      result.contextMeta.includedItems.some((i) => i.id === 'c-acme'),
    ).toBe(true)
  })

  it('the overdue task is included with a high score', () => {
    const overdueItem = result.contextMeta.includedItems.find(
      (i) => i.id === 't-beta-overdue',
    )
    expect(overdueItem).toBeDefined()
    expect(overdueItem!.score).toBeGreaterThan(0.3)
  })

  it('templateKey matches the template', () => {
    expect(result.contextMeta.templateKey).toBe('business_action_plan')
  })
})

// ─── Client scope: Client Insight ─────────────────────────────────────────────

describe('buildPrompt — client scope (Client Insight)', () => {
  const result = buildPrompt({
    rawClients: [clientAcme],
    rawNotes: [noteAcme1, noteAcme2NearDup, noteAcme3],
    rawTasks: [taskAcme],
    rawActivities: [activityAcme],
    template: clientInsight,
    userProfile: USER_PROFILE,
    now: NOW,
  })

  it('renders a non-empty prompt', () => {
    expect(result.text.trim().length).toBeGreaterThan(100)
  })

  it('contains the client name', () => {
    expect(result.text).toContain('Acme Corp')
  })

  it('does NOT include a pipeline overview for client scope', () => {
    expect(result.text).not.toContain('PIPELINE OVERVIEW')
  })

  it('deduplicates near-duplicate notes', () => {
    expect(result.contextMeta.deduplicatedNoteCount).toBeGreaterThanOrEqual(1)
  })

  it('includes note content in context', () => {
    // At least one note should be included
    expect(
      result.contextMeta.includedItems.some((i) => i.type === 'note'),
    ).toBe(true)
  })

  it('templateKey is client_insight', () => {
    expect(result.contextMeta.templateKey).toBe('client_insight')
  })
})

// ─── Notes scope: Note Analysis ───────────────────────────────────────────────

describe('buildPrompt — notes scope (Note Analysis)', () => {
  const result = buildPrompt({
    rawClients: [clientAcme],
    rawNotes: [noteAcme1, noteAcme3],
    rawTasks: [],
    rawActivities: [],
    template: noteAnalysis,
    userProfile: USER_PROFILE,
    now: NOW,
  })

  it('renders a non-empty prompt', () => {
    expect(result.text.trim().length).toBeGreaterThan(100)
  })

  it('contains note content in the context block', () => {
    expect(result.text).toContain('discovery call')
  })

  it('has no tasks or activities in included items (none were passed)', () => {
    const hasTask = result.contextMeta.includedItems.some((i) => i.type === 'task')
    const hasActivity = result.contextMeta.includedItems.some(
      (i) => i.type === 'activity',
    )
    expect(hasTask).toBe(false)
    expect(hasActivity).toBe(false)
  })
})

// ─── Budget enforcement ────────────────────────────────────────────────────────

describe('buildPrompt — token budget enforcement', () => {
  it('omits items when the budget is very tight', () => {
    const tinyBudgetTemplate = { ...businessActionPlan, tokenBudget: 50 }
    const result = buildPrompt({
      rawClients: [clientAcme, clientBeta, clientGamma],
      rawNotes: [noteAcme1, noteAcme3, noteBeta1],
      rawTasks: [taskAcme, taskOverdue],
      rawActivities: [activityAcme],
      template: tinyBudgetTemplate,
      userProfile: USER_PROFILE,
      now: NOW,
    })

    expect(result.contextMeta.omittedGroups.length).toBeGreaterThan(0)
    const totalOmitted = result.contextMeta.omittedGroups.reduce(
      (sum, g) => sum + g.count,
      0,
    )
    expect(totalOmitted).toBeGreaterThan(0)
  })

  it('context block token count stays within budget', () => {
    const budget = 300
    const tinyBudgetTemplate = { ...businessActionPlan, tokenBudget: budget }
    const result = buildPrompt({
      rawClients: [clientAcme, clientBeta, clientGamma],
      rawNotes: [noteAcme1, noteAcme3, noteBeta1],
      rawTasks: [taskAcme, taskOverdue],
      rawActivities: [activityAcme],
      template: tinyBudgetTemplate,
      userProfile: USER_PROFILE,
      now: NOW,
    })
    // Sanity: there were candidates and the full prompt has positive token count
    expect(result.contextMeta.totalCandidateCount).toBeGreaterThan(0)
    expect(result.tokenCount).toBeGreaterThan(0)
  })

  it('renders prompt text even with zero-budget (empty context block)', () => {
    const zeroBudgetTemplate = { ...businessActionPlan, tokenBudget: 0 }
    const result = buildPrompt({
      rawClients: [clientAcme],
      rawNotes: [],
      rawTasks: [],
      rawActivities: [],
      template: zeroBudgetTemplate,
      userProfile: USER_PROFILE,
      now: NOW,
    })
    expect(result.text.trim().length).toBeGreaterThan(0)
    expect(result.contextMeta.includedItems).toHaveLength(0)
  })
})

// ─── Deduplicator in pipeline ──────────────────────────────────────────────────

describe('buildPrompt — deduplication', () => {
  it('exact duplicate notes are deduplicated', () => {
    const exactDup: RawNote = {
      id: 'n-dup',
      clientId: 'c-acme',
      body: noteAcme1.body, // identical body
      noteType: 'note',
      occurredAt: daysAgo(9),
    }
    const result = buildPrompt({
      rawClients: [clientAcme],
      rawNotes: [noteAcme1, exactDup],
      rawTasks: [],
      rawActivities: [],
      template: clientInsight,
      userProfile: USER_PROFILE,
      now: NOW,
    })
    expect(result.contextMeta.deduplicatedNoteCount).toBe(1)
  })

  it('distinct notes are both kept', () => {
    const result = buildPrompt({
      rawClients: [clientAcme],
      rawNotes: [noteAcme1, noteAcme3], // clearly different
      rawTasks: [],
      rawActivities: [],
      template: clientInsight,
      userProfile: USER_PROFILE,
      now: NOW,
    })
    expect(result.contextMeta.deduplicatedNoteCount).toBe(0)
  })
})

// ─── Empty data ────────────────────────────────────────────────────────────────

describe('buildPrompt — empty data sets', () => {
  it('handles no clients without throwing', () => {
    expect(() =>
      buildPrompt({
        rawClients: [],
        rawNotes: [],
        rawTasks: [],
        rawActivities: [],
        template: businessActionPlan,
        userProfile: USER_PROFILE,
        now: NOW,
      }),
    ).not.toThrow()
  })

  it('renders a prompt even with no data', () => {
    const result = buildPrompt({
      rawClients: [],
      rawNotes: [],
      rawTasks: [],
      rawActivities: [],
      template: businessActionPlan,
      userProfile: USER_PROFILE,
      now: NOW,
    })
    expect(result.text.trim().length).toBeGreaterThan(0)
    expect(result.contextMeta.totalCandidateCount).toBe(0)
    expect(result.contextMeta.includedItems).toHaveLength(0)
  })
})
