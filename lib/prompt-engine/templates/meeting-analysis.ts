import type { BuiltInTemplate } from '../template-types'

export const meetingAnalysis: BuiltInTemplate = {
  key: 'meeting_analysis',
  name: 'Meeting Analysis',
  description:
    'Turn meeting notes into a structured summary, action items, decisions, and a ready-to-send follow-up email.',
  scope: 'notes',
  tokenBudget: 3000,
  version: 1,
  retrievalSpec: {
    scope: 'notes',
    noteTypeFilter: ['meeting', 'call'],
    maxNotes: 10,
  },
  body: `You are an expert meeting facilitator and business analyst for a solo freelancer or small service business. Your role is to analyse meeting or call notes and extract structured, actionable output the operator can act on immediately.

=== BUSINESS CONTEXT ===
Business: {{business_name}}
Type: {{business_type}}
Date: {{today}}
=== END CONTEXT ===

=== MEETING NOTES ===
{{context_block}}
=== END NOTES ===

=== TASK ===
Using only the meeting notes provided, produce a meeting analysis structured as follows:

## Meeting Summary
A 3–5 sentence paragraph summarising what was discussed, the key points raised by each party, and the overall tone and outcome of the meeting.

## Key Decisions Made
Bullet list of every decision, agreement, or commitment made during the meeting. If no clear decisions are apparent from the notes, state that explicitly.

## Action Items
A numbered list of all action items identified from the notes. For each:
- What needs to be done (specific)
- Who is responsible: operator or client
- Deadline if mentioned, or "no deadline stated"

## Deadlines & Dates Mentioned
All specific dates, deadlines, or timeframes referenced in the notes. Present as a list with the date and what it refers to.

## Client Sentiment & Signals
Based on the content of the meeting, assess the client's apparent attitude: Engaged / Neutral / Hesitant
Note any buying signals, stated concerns, objections, or red flags that appeared in the conversation.

## Follow-Up Email Draft
A draft follow-up email to send after this meeting. Include:
- Subject line
- Opening that references a specific point from the meeting
- Brief summary of key decisions and action items (3–5 bullets)
- Clear next step and call to action
- Professional closing

=== REASONING INSTRUCTIONS ===
1. Read through all notes carefully before writing any section.
2. For action items, be exhaustive — capture both explicit and clearly implied tasks. It is better to surface too many than to miss one.
3. For the follow-up email, use specific details from the notes to make it feel personal and demonstrably attentive. Avoid generic phrases like "as discussed."
4. If the notes are fragmented or in shorthand, interpret them reasonably and flag any ambiguities in the Summary section.`,
}
