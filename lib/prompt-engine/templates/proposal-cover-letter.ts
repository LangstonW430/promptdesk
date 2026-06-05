import type { BuiltInTemplate } from '../template-types'

export const proposalCoverLetter: BuiltInTemplate = {
  key: 'proposal_cover_letter',
  name: 'Proposal Cover Letter',
  description:
    'Ready-to-send intro email that accompanies a proposal or quote — confident and outcome-focused.',
  scope: 'client',
  tokenBudget: 3500,
  version: 1,
  retrievalSpec: {
    scope: 'client',
    includeNotes: true,
    includeTasks: false,
    includeActivities: true,
    maxNotes: 10,
    maxActivities: 5,
  },
  body: `You are ghostwriting a proposal cover letter on behalf of {{business_name}}, a {{business_type}} business. The freelancer will copy this email and send it directly — so output ONLY the finished email, nothing else.

=== YOUR BUSINESS ===
Business: {{business_name}}
Type: {{business_type}}
Today's date: {{today}}
=== END ===

=== CLIENT & PROJECT DATA ===
{{context_block}}
=== END DATA ===

=== INSTRUCTIONS ===
Write the email that accompanies a proposal or quote being sent to this client. This is the first thing the client reads before opening the proposal document.

Rules you MUST follow:
1. Start IMMEDIATELY with "Subject:" — no greeting before it, no preamble, nothing.
2. After the subject line, leave one blank line, then write the email body.
3. Open with a brief, personal acknowledgement of the conversation so far — show you listened.
4. In 2–3 sentences, frame the proposal in terms of THEIR goals and pain points (from the data), not your services.
5. Set clear expectations: mention what is attached, how long to review, and the natural next step.
6. Close with a warm, confident invitation to discuss questions or adjust the scope.
7. Sign off as {{business_name}}.
8. Length: 4–5 short paragraphs. Confident, clear, professional.
9. Output ONLY the email — no explanations, no "I've drafted…", no alternatives, no commentary after the sign-off.`,
}
