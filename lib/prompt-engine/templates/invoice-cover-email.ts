import type { BuiltInTemplate } from '../template-types'

export const invoiceCoverEmail: BuiltInTemplate = {
  key: 'invoice_cover_email',
  name: 'Invoice Cover Email',
  description:
    'A professional email to send with an invoice — friendly, clear, and includes all the key details.',
  scope: 'global',
  tokenBudget: 2000,
  // v2: the payment link. Stripe hosts the page the client pays on, so a cover
  // email that does not carry the link asks them to go and find it.
  version: 2,
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
Client: {{client_name}}
Invoice: {{invoice_number}}
Total due: {{invoice_total}}
Due date: {{due_date}}
Work billed: {{line_items_summary}}
Payment link: {{payment_link}}
{{context_block}}
=== END DETAILS ===

=== INSTRUCTIONS ===
Write a short, professional email that:

1. Start IMMEDIATELY with "Subject:" — no greeting before it, no "Here's the email:", nothing.
2. After the subject line, leave one blank line, then write the email body.
3. Opens with a warm but direct greeting using the client name from the details above.
4. States the invoice number and total amount clearly in the first or second sentence.
5. Reminds them of the due date without being pushy.
6. If a payment link appears in the details above, includes it on its own line and says plainly that they can pay from it. If there is no link, say nothing about how to pay — do not invent a method.
7. Offers to answer any questions about the invoice.
8. Closes warmly, signing off as {{business_name}}.
9. Output ONLY the email — no explanations, no commentary, no alternatives.

Tone: professional yet personable — not stiff, not overly casual.
Length: 4–6 short paragraphs maximum. No fluff.`,
}
