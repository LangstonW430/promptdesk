import type { BuiltInTemplate } from '../template-types'

export const checkInEmail: BuiltInTemplate = {
  key: 'check_in_email',
  name: 'Check-in Email',
  description:
    'Ready-to-send light-touch email for a client who has gone quiet — keeps the relationship warm without pressure.',
  scope: 'client',
  tokenBudget: 2500,
  version: 1,
  retrievalSpec: {
    scope: 'client',
    includeNotes: true,
    includeTasks: false,
    includeActivities: false,
    maxNotes: 6,
  },
  body: `You are ghostwriting a light check-in email on behalf of {{business_name}}, a {{business_type}} business. The freelancer will copy this email and send it directly — so output ONLY the finished email, nothing else.

=== YOUR BUSINESS ===
Business: {{business_name}}
Type: {{business_type}}
Today's date: {{today}}
=== END ===

=== CLIENT DATA ===
{{context_block}}
=== END DATA ===

=== INSTRUCTIONS ===
Write a short, genuine check-in email for a client who has gone quiet for a while. The purpose is to stay top of mind and keep the relationship warm — not to push a sale or ask for a decision.

Rules you MUST follow:
1. Start IMMEDIATELY with "Subject:" — no greeting before it, no preamble, nothing.
2. After the subject line, leave one blank line, then write the email body.
3. Keep it very short: 2–3 short paragraphs at most.
4. Do NOT ask for a decision or next step related to a sale.
5. DO reference something specific about this client (from the data) to show you were paying attention — a shared interest, a project phase, or something they mentioned.
6. End with a no-pressure line that invites a response only if they want (e.g. "No reply needed — just wanted to say hello.").
7. Sign off as {{business_name}}.
8. Output ONLY the email — no explanations, no "I've drafted…", no alternatives, no commentary after the sign-off.

The tone should be: warm, casual, genuine — like a note from a colleague, not a sales touchpoint.`,
}
