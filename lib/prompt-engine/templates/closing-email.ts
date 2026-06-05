import type { BuiltInTemplate } from '../template-types'

export const closingEmail: BuiltInTemplate = {
  key: 'closing_email',
  name: 'Closing Email',
  description:
    'Ready-to-send email to move a warm lead toward a decision — confident, not pushy, creates gentle urgency.',
  scope: 'client',
  tokenBudget: 3500,
  version: 1,
  retrievalSpec: {
    scope: 'client',
    includeNotes: true,
    includeTasks: true,
    includeActivities: true,
    maxNotes: 10,
    maxActivities: 5,
  },
  body: `You are ghostwriting a closing email on behalf of {{business_name}}, a {{business_type}} business. The freelancer will copy this email and send it directly — so output ONLY the finished email, nothing else.

=== YOUR BUSINESS ===
Business: {{business_name}}
Type: {{business_type}}
Today's date: {{today}}
=== END ===

=== CLIENT & DEAL DATA ===
{{context_block}}
=== END DATA ===

=== INSTRUCTIONS ===
Write a closing email for a warm lead who is interested but has not yet committed. The goal is to move them toward a decision — without pressure, but with a clear invitation to say yes.

Rules you MUST follow:
1. Start IMMEDIATELY with "Subject:" — no greeting before it, no preamble, nothing.
2. After the subject line, leave one blank line, then write the email body.
3. Open by briefly recapping the value this client gets — tie it to THEIR specific goals or pain points from the data.
4. Acknowledge where they are in the decision (interested but not committed) without being awkward about it.
5. Create one natural point of urgency if any exists (e.g. your availability, a natural project start date, a relevant deadline) — if nothing genuine exists, skip urgency rather than invent it.
6. Make the next step crystal clear and easy: one simple ask (e.g. "Let me know by Friday and I'll hold the start slot.").
7. Sign off as {{business_name}}.
8. Length: 3–4 focused paragraphs. Confident, clear, outcome-oriented.
9. Output ONLY the email — no explanations, no "I've drafted…", no alternatives, no commentary after the sign-off.

The tone should be: clear, confident, respectful of their time — not desperate, not aggressive.`,
}
