import type { BuiltInTemplate } from '../template-types'

export const invoiceCoverEmail: BuiltInTemplate = {
  key: 'invoice_cover_email',
  name: 'Invoice Cover Email',
  description:
    'A professional email to send with an invoice — friendly, clear, and includes all the key details.',
  scope: 'global',
  tokenBudget: 2000,
  version: 1,
  retrievalSpec: {
    scope: 'global',
  },
  body: `You are ghostwriting a concise, professional invoice cover email on behalf of {{business_name}}, a {{business_type}} business. The freelancer will copy and send this email directly — output ONLY the finished email, nothing else.

=== YOUR BUSINESS ===
Business: {{business_name}}
Type: {{business_type}}
Today's date: {{today}}
=== END ===

=== INVOICE & CLIENT DETAILS ===
{{context_block}}
=== END DETAILS ===

=== INSTRUCTIONS ===
Write a short, professional email that:

1. Start IMMEDIATELY with "Subject:" — no greeting before it, no "Here's the email:", nothing.
2. After the subject line, leave one blank line, then write the email body.
3. Opens with a warm but direct greeting using the client name from the details above.
4. States the invoice number and total amount clearly in the first or second sentence.
5. Reminds them of the due date without being pushy.
6. Offers to answer any questions about the invoice.
7. Closes warmly, signing off as {{business_name}}.
8. Output ONLY the email — no explanations, no commentary, no alternatives.

Tone: professional yet personable — not stiff, not overly casual.
Length: 4–6 short paragraphs maximum. No fluff.`,
}
