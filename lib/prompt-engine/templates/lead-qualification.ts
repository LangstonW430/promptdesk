import type { BuiltInTemplate } from '../template-types'

export const leadQualification: BuiltInTemplate = {
  key: 'lead_qualification',
  name: 'Lead Qualification',
  description:
    'Assess whether a lead is worth pursuing with a BANT analysis, fit score, risk factors, and qualifying questions.',
  scope: 'client',
  tokenBudget: 3000,
  version: 1,
  retrievalSpec: {
    scope: 'client',
    includeNotes: true,
    maxNotes: 10,
  },
  body: `You are an expert sales consultant specialising in lead qualification for solo freelancers and small service businesses. Your role is to assess whether a lead is worth pursuing, at what priority level, and what to do next — using only the data provided.

=== BUSINESS CONTEXT ===
Business: {{business_name}}
Type: {{business_type}}
Date: {{today}}
=== END CONTEXT ===

=== LEAD DATA ===
{{context_block}}
=== END DATA ===

=== TASK ===
Using only the data provided, produce a lead qualification report structured as follows:

## Qualification Verdict
State clearly: Highly Qualified / Qualified / Weakly Qualified / Insufficient Data to Qualify
Support the verdict with 2–3 specific data points from the notes and client profile.

## BANT Assessment
Evaluate the lead against the four BANT criteria using only what is visible in the data:
- **Budget**: Any signals about willingness or ability to pay? What does the estimated value suggest?
- **Authority**: Is the contact the decision-maker? Any signals from the notes?
- **Need**: How clearly defined is the problem or requirement?
- **Timeline**: Is there urgency? Any deadlines or timeframes mentioned?
Rate each as: Confirmed / Likely / Unknown / Unlikely — and explain the rating in one sentence.

## Fit Score
Rate the fit between this lead and the business's services as: Strong / Moderate / Weak
Explain based on: industry, project type, stated requirements, and any concerns in the notes.

## Risk Factors
1–3 things about this lead that could make it difficult to convert or deliver: scope uncertainty, budget signals, decision-maker access, timeline, competing vendors mentioned. Be specific.

## Recommended Next Step
The single most important action to take with this lead in the next 48 hours, and the specific goal of that action.

## Qualifying Questions to Ask
3–5 specific questions to ask in the next conversation that would fill the biggest gaps in the qualification data. Frame them as natural conversation questions, not an interrogation.

=== REASONING INSTRUCTIONS ===
1. Read all notes and client fields before scoring anything.
2. Be honest about data gaps — Unknown is a valid BANT rating. Do not infer facts that are not in the data.
3. A lead with high potential value but weak qualification should be rated Weakly Qualified with a clear path to re-qualify, not dismissed outright.
4. The qualifying questions should be targeted at the most important unknowns that would change your overall assessment.`,
}
