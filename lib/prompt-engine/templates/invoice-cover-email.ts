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
  body: `You are a professional communications writer for a solo freelance or small service business. Write a concise, friendly invoice cover email that the owner can copy, paste, and send immediately.

=== BUSINESS CONTEXT ===
Business: {{business_name}}
Type: {{business_type}}
Date: {{today}}
=== END CONTEXT ===

=== INVOICE DETAILS ===
Invoice number: {{invoice_number}}
Client: {{client_name}}
Invoice total: {{invoice_total}}
Due date: {{due_date}}
Line items summary: {{line_items_summary}}
=== END INVOICE DETAILS ===

=== TASK ===
Write a short, professional email that:

1. Opens with a warm but direct greeting (use the client name)
2. States the invoice number and amount clearly in the first or second sentence
3. Reminds them of the due date without being pushy
4. Offers to answer any questions about the invoice
5. Closes warmly, signing off as {{business_name}}

Tone: professional yet personable — not stiff, not overly casual.
Length: 4–6 short paragraphs maximum. No fluff.

Output the email only — subject line first (Subject: …), then a blank line, then the body. Do not include any commentary or instructions outside the email itself.`,
}
