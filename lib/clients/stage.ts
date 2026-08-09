/**
 * Where a client sits, derived from their work rather than stored separately.
 *
 * Clients used to carry their own `status` (lead → contacted → proposal_sent →
 * negotiating → won → lost) alongside a project status describing the work.
 * Once value moved onto projects and `proposed` existed, the two overlapped:
 * a client with a proposed project *is* "proposal sent", one with an active
 * project *is* "won". Two fields saying the same thing is two fields to keep
 * in agreement, and they drifted the moment either was edited alone.
 *
 * The stage is now computed. Nothing to set, nothing to contradict.
 */

export const CLIENT_STAGES = [
  'lead',
  'contacted',
  'proposal_out',
  'active',
  'past',
  'lost',
] as const

export type ClientStage = (typeof CLIENT_STAGES)[number]

export const CLIENT_STAGE_LABELS: Record<ClientStage, string> = {
  lead: 'Lead',
  contacted: 'Contacted',
  proposal_out: 'Proposal out',
  active: 'Active client',
  past: 'Past client',
  lost: 'Lost',
}

/** Stages that represent live pipeline — not won, not finished, not dead. */
export const OPEN_STAGES: readonly ClientStage[] = ['lead', 'contacted', 'proposal_out']

/** Everything the rule needs. Kept free of Prisma types so it stays testable. */
export interface StageInput {
  isArchived: boolean
  hasActiveProject: boolean
  hasProposedProject: boolean
  hasCompletedProject: boolean
  /** Any recorded contact — a date on the client, or a logged note. */
  hasBeenContacted: boolean
}

/**
 * The single rule, in priority order.
 *
 * Archived wins outright: filing someone away is an explicit statement that
 * they are out of the pipeline, and it should not be overridden by whatever
 * projects they happen to still have attached.
 *
 * Live work then outranks a quote, which outranks finished work — a client
 * with an active project and an old completed one is active, not past. Only
 * when there is no work at all does the relationship itself decide, and a
 * recorded contact is the difference between someone you have spoken to and a
 * name you have not touched yet.
 */
export function deriveClientStage(input: StageInput): ClientStage {
  if (input.isArchived) return 'lost'
  if (input.hasActiveProject) return 'active'
  if (input.hasProposedProject) return 'proposal_out'
  if (input.hasCompletedProject) return 'past'
  if (input.hasBeenContacted) return 'contacted'
  return 'lead'
}

/**
 * Probability that a client at this stage turns into revenue, for the
 * forecast. Deliberately transparent and adjustable rather than learned —
 * an unexplainable number on a dashboard is one nobody trusts.
 */
export const STAGE_PROBABILITY: Record<ClientStage, number> = {
  lead: 0.1,
  contacted: 0.25,
  proposal_out: 0.5,
  active: 1,
  past: 0,
  lost: 0,
}
