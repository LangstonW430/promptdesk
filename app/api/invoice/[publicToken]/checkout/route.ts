import Stripe from 'stripe'
import { getInvoiceByPublicToken } from '@/lib/invoices'
import { getStripeForOwner } from '@/lib/finance/stripe-client'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ publicToken: string }> },
): Promise<Response> {
  const { publicToken } = await params

  const invoice = await getInvoiceByPublicToken(publicToken)
  if (!invoice) {
    return Response.json({ error: 'Invoice not found' }, { status: 404 })
  }
  if (invoice.status === 'paid') {
    return Response.json({ error: 'This invoice has already been paid.' }, { status: 400 })
  }
  if (invoice.status === 'draft') {
    return Response.json({ error: 'This invoice has not been sent yet.' }, { status: 400 })
  }

  let stripe: Stripe
  try {
    stripe = await getStripeForOwner(invoice.ownerId)
  } catch {
    return Response.json(
      { error: 'Online payment is not available for this invoice.' },
      { status: 400 },
    )
  }

  const origin =
    req.headers.get('origin') ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000'

  const returnBase = `${origin}/invoice/${publicToken}`

  // Map line items — each becomes a single quantity at its total amount (in cents)
  // so fractional quantities (e.g. "2.5 hrs") display cleanly on the Stripe page.
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = invoice.lineItems.map(
    (item) => ({
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(item.amount * 100),
        product_data: { name: item.description },
      },
      quantity: 1,
    }),
  )

  if (invoice.tax != null && invoice.tax > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        unit_amount: Math.round(invoice.tax * 100),
        product_data: { name: 'Tax' },
      },
      quantity: 1,
    })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      success_url: `${returnBase}?paid=1`,
      cancel_url: returnBase,
      metadata: {
        invoiceId: invoice.id,
        ownerId: invoice.ownerId,
        publicToken,
      },
      payment_intent_data: {
        metadata: {
          invoiceId: invoice.id,
          ownerId: invoice.ownerId,
        },
      },
    })

    return Response.json({ url: session.url })
  } catch (err) {
    if (err instanceof Stripe.errors.StripePermissionError) {
      return Response.json(
        {
          error:
            'Stripe key lacks permission to create payments. Enable "Checkout Sessions: Write" and "Payment Intents: Write" in your Stripe restricted key settings.',
        },
        { status: 400 },
      )
    }
    const msg = err instanceof Error ? err.message : 'Failed to create payment session'
    return Response.json({ error: msg }, { status: 500 })
  }
}
