import { businessAdvisor } from './business-advisor'
import { businessActionPlan } from './business-action-plan'
import { weeklyPlanning } from './weekly-planning'
import { revenueAnalysis } from './revenue-analysis'
import { clientReview } from './client-review'
import { clientInsight } from './client-insight'
import { proposalStrategy } from './proposal-strategy'
import { followUpRecommendations } from './follow-up-recommendations'
import { meetingAnalysis } from './meeting-analysis'
import { noteAnalysis } from './note-analysis'
import { leadQualification } from './lead-qualification'
import { invoiceCoverEmail } from './invoice-cover-email'
import { followUpEmail } from './follow-up-email'
import { proposalCoverLetter } from './proposal-cover-letter'
import { checkInEmail } from './check-in-email'
import { closingEmail } from './closing-email'
import type { BuiltInTemplate } from '../template-types'

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
  // ── Global scope ──────────────────────────────────────────────────────────
  businessAdvisor,
  businessActionPlan,
  weeklyPlanning,
  revenueAnalysis,
  followUpRecommendations,
  invoiceCoverEmail,
  // ── Client scope ──────────────────────────────────────────────────────────
  clientReview,
  clientInsight,
  proposalStrategy,
  leadQualification,
  // ── Client email drafts ───────────────────────────────────────────────────
  followUpEmail,
  proposalCoverLetter,
  checkInEmail,
  closingEmail,
  // ── Notes scope ───────────────────────────────────────────────────────────
  meetingAnalysis,
  noteAnalysis,
]

export {
  businessAdvisor,
  businessActionPlan,
  weeklyPlanning,
  revenueAnalysis,
  clientReview,
  clientInsight,
  proposalStrategy,
  followUpRecommendations,
  meetingAnalysis,
  noteAnalysis,
  leadQualification,
  invoiceCoverEmail,
  followUpEmail,
  proposalCoverLetter,
  checkInEmail,
  closingEmail,
}
