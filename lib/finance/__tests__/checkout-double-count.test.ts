import { describe, it, expect } from 'vitest'
import type Stripe from 'stripe'
import { chargeToTransaction } from '../stripe-mapper'

/**
 * A client paying an invoice through the public link produces two webhooks for
 * one payment: `checkout.session.completed`, which markInvoicePaidFromCheckout
 * records against the payment intent, and `charge.succeeded`, which the Stripe
 * sync records against the charge.
 *
 * The idempotency key is (ownerId, source, externalId). If those two paths
 * disagree about the id, the same money lands in Finance twice — and the
 * invoice total is usually the largest number in the month.
 *
 * markInvoicePaidFromCheckout already looks for an existing row by payment
 * intent id before creating one, so the two only need to agree on the key.
 */

const OWNER = 'owner-abc'

const charge = (over: Partial<Stripe.Charge> = {}) =>
  ({
    id: 'ch_3Qtest',
    object: 'charge',
    amount: 2_387_000,
    currency: 'usd',
    created: 1_775_000_000,
    description: 'Payment for INV-0042',
    payment_intent: 'pi_3Qtest',
    billing_details: { email: 'ap@peaks.example', name: 'Peaks & Partners' },
    payment_method_details: { card: { last4: '4242', brand: 'visa' } },
    refunds: { data: [] },
    ...over,
  }) as unknown as Stripe.Charge

describe('charge income row — idempotency key', () => {
  it('keys on the payment intent, which is what the checkout path also uses', () => {
    const row = chargeToTransaction(charge(), OWNER)

    // markInvoicePaidFromCheckout writes externalId = the payment intent id.
    // Keying the charge on `ch_...` instead put the same payment in twice.
    expect(row.externalId).toBe('pi_3Qtest')
  })

  it('falls back to the charge id when there is no payment intent', () => {
    // Older or non-PaymentIntent charges still need a stable key of their own.
    const row = chargeToTransaction(charge({ payment_intent: null }), OWNER)
    expect(row.externalId).toBe('ch_3Qtest')
  })

  it('handles an expanded payment intent object rather than an id string', () => {
    const expanded = charge({
      payment_intent: { id: 'pi_expanded' } as unknown as Stripe.PaymentIntent,
    })
    expect(chargeToTransaction(expanded, OWNER).externalId).toBe('pi_expanded')
  })

  it('still records the amount and type as income', () => {
    const row = chargeToTransaction(charge(), OWNER)
    expect(row.type).toBe('income')
    expect(row.amount).toBe(23_870)
  })
})
