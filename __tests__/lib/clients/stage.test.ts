import { describe, it, expect } from 'vitest'
import {
  CLIENT_STAGES,
  OPEN_STAGES,
  STAGE_PROBABILITY,
  deriveClientStage,
  type StageInput,
} from '@/lib/clients/stage'

const NOTHING: StageInput = {
  isArchived: false,
  hasActiveProject: false,
  hasProposedProject: false,
  hasCompletedProject: false,
  hasBeenContacted: false,
}

const stage = (over: Partial<StageInput> = {}) => deriveClientStage({ ...NOTHING, ...over })

describe('deriveClientStage', () => {
  it('is a lead when nothing has happened yet', () => {
    expect(stage()).toBe('lead')
  })

  it('is contacted once there is a recorded contact but no work', () => {
    expect(stage({ hasBeenContacted: true })).toBe('contacted')
  })

  it('has a proposal out when a project is quoted but not won', () => {
    expect(stage({ hasProposedProject: true })).toBe('proposal_out')
  })

  it('is active as soon as any project is live', () => {
    expect(stage({ hasActiveProject: true })).toBe('active')
  })

  it('is a past client when the only work is finished', () => {
    // Not a lead — treating a client whose projects all completed as an
    // untouched name would put finished business back at the top of the funnel.
    expect(stage({ hasCompletedProject: true })).toBe('past')
  })

  it('is lost when archived', () => {
    expect(stage({ isArchived: true })).toBe('lost')
  })
})

describe('deriveClientStage — precedence', () => {
  it('lets archived override any amount of live work', () => {
    // Archiving is an explicit statement that someone is out of the pipeline;
    // leftover projects must not drag them back in.
    expect(stage({
      isArchived: true,
      hasActiveProject: true,
      hasProposedProject: true,
    })).toBe('lost')
  })

  it('ranks live work above a quote', () => {
    expect(stage({ hasActiveProject: true, hasProposedProject: true })).toBe('active')
  })

  it('ranks a quote above finished work', () => {
    // A past client you have re-quoted is back in the pipeline, not history.
    expect(stage({ hasProposedProject: true, hasCompletedProject: true })).toBe('proposal_out')
  })

  it('keeps a client with old completed work and new live work active', () => {
    expect(stage({ hasActiveProject: true, hasCompletedProject: true })).toBe('active')
  })

  it('lets any work outrank a mere contact record', () => {
    expect(stage({ hasBeenContacted: true, hasProposedProject: true })).toBe('proposal_out')
    expect(stage({ hasBeenContacted: true, hasCompletedProject: true })).toBe('past')
  })
})

describe('stage vocabulary', () => {
  it('assigns every stage a probability', () => {
    for (const s of CLIENT_STAGES) {
      expect(STAGE_PROBABILITY[s]).toBeTypeOf('number')
    }
  })

  it('treats finished and dead relationships as contributing nothing', () => {
    expect(STAGE_PROBABILITY.past).toBe(0)
    expect(STAGE_PROBABILITY.lost).toBe(0)
  })

  it('increases confidence as a client moves down the funnel', () => {
    expect(STAGE_PROBABILITY.lead).toBeLessThan(STAGE_PROBABILITY.contacted)
    expect(STAGE_PROBABILITY.contacted).toBeLessThan(STAGE_PROBABILITY.proposal_out)
    expect(STAGE_PROBABILITY.proposal_out).toBeLessThan(STAGE_PROBABILITY.active)
  })

  it('counts only the stages that are still in play as open', () => {
    expect([...OPEN_STAGES]).toEqual(['lead', 'contacted', 'proposal_out'])
    for (const s of ['active', 'past', 'lost'] as const) {
      expect(OPEN_STAGES).not.toContain(s)
    }
  })

  it('reaches every stage from some input', () => {
    const reached = new Set([
      stage(),
      stage({ hasBeenContacted: true }),
      stage({ hasProposedProject: true }),
      stage({ hasActiveProject: true }),
      stage({ hasCompletedProject: true }),
      stage({ isArchived: true }),
    ])
    expect(reached).toEqual(new Set(CLIENT_STAGES))
  })
})
