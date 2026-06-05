import type { BuiltInTemplate } from '../template-types'

export const followUpEmail: BuiltInTemplate = {
  key: 'follow_up_email',
  name: 'Follow-up Email',
  description:
    'Ready-to-send follow-up after a meeting or proposal where the client has gone quiet.',
  scope: 'client',
  tokenBudget: 3000,
  version: 1,
  retrievalSpec: {
    scope: 'client',
    includeNotes: true,
    includeTasks: false,
    includeActivities: true,
    maxNotes: 8,
    maxActivities: 5,
  },
  body: `You are ghostwriting a short, professional follow-up email on behalf of {{business_name}}, a {{business_type}} business. The freelancer will copy this email and send it directly — so output ONLY the finished email, nothing else.

=== YOUR BUSINESS ===
Business: {{business_name}}
Type: {{business_type}}
Today's date: {{today}}
=== END ===

=== CLIENT & INTERACTION DATA ===
{{context_block}}
=== END DATA ===

=== INSTRUCTIONS ===
Write a follow-up email to this client for a situation where they have not responded after a meeting, call, or proposal.

Rules you MUST follow:
1. Start IMMEDIATELY with "Subject:" — no greeting before it, no "Here's the email:", nothing.
2. After the subject line, leave one blank line, then write the email body.
3. Open by referencing the specific last interaction (call, meeting, email, or proposal) and its approximate date.
4. Keep it to 3 short paragraphs maximum — concise, not pushy.
5. Include one clear, low-friction call to action (e.g. "Let me know if the timing works or if you have questions.").
6. Sign off as {{business_name}}.
7. Output ONLY the email — no explanations, no "I've drafted…", no alternatives, no commentary.

The tone should be: warm, professional, genuinely interested — not desperate, not passive-aggressive.`,
}
