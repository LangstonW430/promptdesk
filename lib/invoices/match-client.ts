/**
 * Deciding which CRM client a Stripe invoice belongs to.
 *
 * Two signals, in order of how much they prove:
 *
 *   1. The Stripe customer id already recorded on a client. This is an
 *      established link — somebody matched them before — so it wins outright.
 *   2. The billing email. Weaker, but it is how a person is actually
 *      identified, and it is the only thing available for a customer the
 *      finance sync has never seen pay.
 *
 * When neither hits, the answer is null and the invoice shows unattributed.
 * A client is never created from an invoice: that would fill the CRM with
 * unvetted contacts every time somebody was billed once, which is the same
 * reason `linkTransactionsByEmail` refuses to. The user links it by hand
 * instead, and that link then serves every later invoice through signal 1.
 */

import { prisma } from '@/lib/db/client'

export interface InvoiceCounterparty {
  stripeCustomerId: string | null
  email: string | null
}

/**
 * Finds the client for an invoice, back-filling the Stripe customer id when the
 * match came from the email.
 *
 * That back-fill is the point: the next invoice for the same person matches on
 * the id instead, which survives them changing their email address.
 */
export async function matchClientForInvoice(
  ownerId: string,
  counterparty: InvoiceCounterparty,
): Promise<string | null> {
  const { stripeCustomerId, email } = counterparty

  if (stripeCustomerId) {
    const byId = await prisma.client.findFirst({
      where: { ownerId, stripeCustomerId },
      select: { id: true },
    })
    if (byId) return byId.id
  }

  if (!email) return null

  // Case-insensitive: Stripe preserves whatever case the customer typed, and a
  // client saved as "Jane@acme.com" is the same person as "jane@acme.com".
  const byEmail = await prisma.client.findFirst({
    where: { ownerId, email: { equals: email, mode: 'insensitive' } },
    select: { id: true, stripeCustomerId: true },
  })
  if (!byEmail) return null

  if (!byEmail.stripeCustomerId && stripeCustomerId) {
    await prisma.client.update({
      where: { id: byEmail.id },
      data: { stripeCustomerId },
    })
  }

  return byEmail.id
}
