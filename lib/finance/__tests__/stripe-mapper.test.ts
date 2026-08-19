import { describe, it, expect } from 'vitest'
import type Stripe from 'stripe'
import {
  chargeToTransaction,
  chargeFeeToTransaction,
  refundToTransaction,
  subscriptionIdOf,
} from '../stripe-mapper'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const OWNER = 'owner-uuid-123'

// Minimal balance transaction fixture (fee = $3.20)
function makeBalanceTx(fee = 320): Stripe.BalanceTransaction {
  return {
    id: 'txn_test',
    object: 'balance_transaction',
    fee,
    fee_details: [{ amount: fee, currency: 'usd', description: 'Stripe processing fees', type: 'stripe_fee' }],
    amount: 10000 - fee,
    available_on: 1735776000,
    created: 1735689600,
    currency: 'usd',
    description: null,
    exchange_rate: null,
    net: 10000 - fee,
    reporting_category: 'charge',
    source: 'ch_test123',
    status: 'available',
    type: 'charge',
  } as unknown as Stripe.BalanceTransaction
}

// Minimal customer fixture
function makeCustomer(email = 'jane@acme.com', id = 'cus_test'): Stripe.Customer {
  return {
    id,
    object: 'customer',
    email,
    name: 'Jane Smith',
    deleted: undefined,
  } as unknown as Stripe.Customer
}

// Full charge fixture with balance_transaction and customer expanded
function makeCharge(overrides: Record<string, unknown> = {}): Stripe.Charge {
  return {
    id: 'ch_test123',
    object: 'charge',
    amount: 10000,           // $100.00
    currency: 'usd',
    created: 1735689600,     // 2025-01-01T00:00:00Z
    status: 'succeeded',
    captured: true,
    description: 'Invoice for web design',
    billing_details: {
      name: 'Jane Smith',
      email: 'jane@acme.com',
      address: null,
      phone: null,
    },
    payment_method_details: {
      card: { last4: '4242', brand: 'visa' },
      type: 'card',
    },
    balance_transaction: makeBalanceTx(),
    customer: makeCustomer(),
    refunds: {
      object: 'list',
      data: [],
      has_more: false,
      url: '/v1/charges/ch_test123/refunds',
      total_count: 0,
    },
    ...overrides,
  } as unknown as Stripe.Charge
}

// Minimal refund fixture
function makeRefund(
  id = 're_test',
  amount = 5000,
  chargeId = 'ch_test123',
): Stripe.Refund {
  return {
    id,
    object: 'refund',
    amount,
    currency: 'usd',
    created: 1735776000,
    charge: chargeId,
    reason: 'requested_by_customer',
    status: 'succeeded',
  } as unknown as Stripe.Refund
}

// ─── chargeToTransaction ──────────────────────────────────────────────────────

describe('chargeToTransaction', () => {
  it('produces an income row', () => {
    const result = chargeToTransaction(makeCharge(), OWNER)
    expect(result.type).toBe('income')
    expect(result.source).toBe('stripe')
    expect(result.ownerId).toBe(OWNER)
    expect(result.clientId).toBeNull()
  })

  it('converts cents to dollars', () => {
    const result = chargeToTransaction(makeCharge({ amount: 15050 }), OWNER)
    expect(result.amount).toBe(150.50)
  })

  it('uses the charge id as externalId with externalType "charge"', () => {
    const result = chargeToTransaction(makeCharge(), OWNER)
    expect(result.externalId).toBe('ch_test123')
    expect(result.externalType).toBe('charge')
  })

  it('sets occurredAt from charge.created (Unix seconds → Date)', () => {
    const result = chargeToTransaction(makeCharge(), OWNER)
    expect(result.occurredAt).toEqual(new Date(1735689600 * 1000))
    expect(result.occurredAt.toISOString()).toBe('2025-01-01T00:00:00.000Z')
  })

  it('lowercases the currency', () => {
    const result = chargeToTransaction(makeCharge({ currency: 'USD' }), OWNER)
    expect(result.currency).toBe('usd')
  })

  it('uses category "Stripe payment"', () => {
    expect(chargeToTransaction(makeCharge(), OWNER).category).toBe('Stripe payment')
  })

  it('copies description from charge', () => {
    const result = chargeToTransaction(makeCharge({ description: 'Logo design' }), OWNER)
    expect(result.description).toBe('Logo design')
  })

  it('stores null description when charge has none', () => {
    const result = chargeToTransaction(makeCharge({ description: null }), OWNER)
    expect(result.description).toBeNull()
  })

  it('stores counterparty name and email from billing_details', () => {
    const result = chargeToTransaction(makeCharge(), OWNER)
    expect(result.metadata.counterpartyName).toBe('Jane Smith')
    expect(result.metadata.counterpartyEmail).toBe('jane@acme.com')
  })

  it('falls back to customer email when billing_details.email is null', () => {
    const charge = makeCharge({
      billing_details: { name: null, email: null, address: null, phone: null },
      customer: makeCustomer('customer@example.com'),
    })
    const result = chargeToTransaction(charge, OWNER)
    expect(result.metadata.counterpartyEmail).toBe('customer@example.com')
  })

  it('stores stripeCustomerId from expanded customer', () => {
    const result = chargeToTransaction(makeCharge(), OWNER)
    expect(result.metadata.stripeCustomerId).toBe('cus_test')
  })

  it('stores stripeCustomerId from non-expanded customer string', () => {
    const charge = makeCharge({ customer: 'cus_stringref' })
    const result = chargeToTransaction(charge, OWNER)
    expect(result.metadata.stripeCustomerId).toBe('cus_stringref')
  })

  it('stores last4 and brand from payment_method_details — no full card numbers', () => {
    const result = chargeToTransaction(makeCharge(), OWNER)
    expect(result.metadata.last4).toBe('4242')
    expect(result.metadata.brand).toBe('visa')
  })

  it('handles null payment_method_details gracefully', () => {
    const charge = makeCharge({ payment_method_details: null })
    const result = chargeToTransaction(charge, OWNER)
    expect(result.metadata.last4).toBeNull()
    expect(result.metadata.brand).toBeNull()
  })
})

// ─── chargeFeeToTransaction ───────────────────────────────────────────────────

describe('chargeFeeToTransaction', () => {
  it('produces an expense row', () => {
    const result = chargeFeeToTransaction(makeCharge(), OWNER)
    expect(result?.type).toBe('expense')
    expect(result?.source).toBe('stripe')
  })

  it('converts fee cents to dollars', () => {
    const result = chargeFeeToTransaction(makeCharge(), OWNER)
    expect(result?.amount).toBe(3.20)
  })

  it('uses compound externalId (chargeId + ":fee") with externalType "fee"', () => {
    const result = chargeFeeToTransaction(makeCharge(), OWNER)
    expect(result?.externalId).toBe('ch_test123:fee')
    expect(result?.externalType).toBe('fee')
  })

  it('uses category "Stripe fees"', () => {
    expect(chargeFeeToTransaction(makeCharge(), OWNER)?.category).toBe('Stripe fees')
  })

  it('uses same occurredAt as the charge', () => {
    const result = chargeFeeToTransaction(makeCharge(), OWNER)
    expect(result?.occurredAt).toEqual(new Date(1735689600 * 1000))
  })

  it('returns null when balance_transaction is not expanded (string id)', () => {
    const charge = makeCharge({ balance_transaction: 'txn_notexpanded' })
    expect(chargeFeeToTransaction(charge, OWNER)).toBeNull()
  })

  it('returns null when balance_transaction is null', () => {
    const charge = makeCharge({ balance_transaction: null })
    expect(chargeFeeToTransaction(charge, OWNER)).toBeNull()
  })

  it('returns null when fee is zero', () => {
    const charge = makeCharge({ balance_transaction: makeBalanceTx(0) })
    expect(chargeFeeToTransaction(charge, OWNER)).toBeNull()
  })

  it('stores chargeId in metadata', () => {
    const result = chargeFeeToTransaction(makeCharge(), OWNER)
    expect(result?.metadata.chargeId).toBe('ch_test123')
  })

  it('clientId is always null (set later by sync engine)', () => {
    expect(chargeFeeToTransaction(makeCharge(), OWNER)?.clientId).toBeNull()
  })
})

// ─── refundToTransaction ──────────────────────────────────────────────────────

describe('refundToTransaction', () => {
  const charge = makeCharge()

  it('produces an expense row (positive amount, type = expense)', () => {
    const result = refundToTransaction(makeRefund(), charge, OWNER)
    expect(result.type).toBe('expense')
    expect(result.source).toBe('stripe')
    expect(result.amount).toBeGreaterThan(0)
  })

  it('converts refund cents to dollars', () => {
    const result = refundToTransaction(makeRefund('re_1', 5000), charge, OWNER)
    expect(result.amount).toBe(50.00)
  })

  it('uses the refund id as externalId with externalType "refund"', () => {
    const result = refundToTransaction(makeRefund('re_abc'), charge, OWNER)
    expect(result.externalId).toBe('re_abc')
    expect(result.externalType).toBe('refund')
  })

  it('sets occurredAt from refund.created', () => {
    const result = refundToTransaction(makeRefund(), charge, OWNER)
    expect(result.occurredAt).toEqual(new Date(1735776000 * 1000))
  })

  it('stores chargeId and reason in metadata', () => {
    const result = refundToTransaction(makeRefund(), charge, OWNER)
    expect(result.metadata.chargeId).toBe('ch_test123')
    expect(result.metadata.reason).toBe('requested_by_customer')
  })

  it('handles null reason gracefully', () => {
    const refund = makeRefund('re_1', 1000)
    ;(refund as unknown as Record<string, unknown>).reason = null
    const result = refundToTransaction(refund, charge, OWNER)
    expect(result.metadata.reason).toBeNull()
  })

  it('clientId is always null', () => {
    expect(refundToTransaction(makeRefund(), charge, OWNER).clientId).toBeNull()
  })

  it('income + refund nets to zero for a full refund', () => {
    const income = chargeToTransaction(charge, OWNER)
    const refund = refundToTransaction(makeRefund('re_1', charge.amount), charge, OWNER)
    const net = income.amount - refund.amount
    expect(net).toBe(0)
  })
})

// ─── subscriptionIdOf ─────────────────────────────────────────────────────────

describe('subscriptionIdOf', () => {
  it('reads the subscription id from an expanded invoice on the charge', () => {
    const charge = makeCharge({
      invoice: { id: 'in_1', object: 'invoice', subscription: 'sub_abc' },
    })
    expect(subscriptionIdOf(charge)).toBe('sub_abc')
  })

  it('reads it through payment_intent.invoice', () => {
    const charge = makeCharge({
      invoice: null,
      payment_intent: {
        id: 'pi_1',
        object: 'payment_intent',
        invoice: { id: 'in_1', object: 'invoice', subscription: 'sub_xyz' },
      },
    })
    expect(subscriptionIdOf(charge)).toBe('sub_xyz')
  })

  it('unwraps an expanded subscription object to its id', () => {
    const charge = makeCharge({
      invoice: {
        id: 'in_1',
        object: 'invoice',
        subscription: { id: 'sub_expanded', object: 'subscription' },
      },
    })
    expect(subscriptionIdOf(charge)).toBe('sub_expanded')
  })

  // An unexpanded invoice genuinely does not carry the id. Returning null says
  // "not known from this payload" — the backfill expands invoices and fills it
  // in later. It must never be read as "this charge is one-off".
  it('returns null when the invoice is an unexpanded string id', () => {
    expect(subscriptionIdOf(makeCharge({ invoice: 'in_1' }))).toBeNull()
  })

  it('returns null for a one-off charge with no invoice at all', () => {
    expect(subscriptionIdOf(makeCharge({ invoice: null }))).toBeNull()
  })

  it('returns null when the invoice carries no subscription', () => {
    const charge = makeCharge({
      invoice: { id: 'in_1', object: 'invoice', subscription: null },
    })
    expect(subscriptionIdOf(charge)).toBeNull()
  })

  it('puts the id on the charge row so a cancellation can find it later', () => {
    const charge = makeCharge({
      invoice: { id: 'in_1', object: 'invoice', subscription: 'sub_abc' },
    })
    expect(chargeToTransaction(charge, OWNER).stripeSubscriptionId).toBe('sub_abc')
  })

  it('leaves the fee row pointing at the same subscription as its charge', () => {
    const charge = makeCharge({
      invoice: { id: 'in_1', object: 'invoice', subscription: 'sub_abc' },
    })
    expect(chargeFeeToTransaction(charge, OWNER)?.stripeSubscriptionId).toBe('sub_abc')
  })

  it('never attributes a refund to a subscription', () => {
    const charge = makeCharge({
      invoice: { id: 'in_1', object: 'invoice', subscription: 'sub_abc' },
    })
    expect(
      refundToTransaction(makeRefund(), charge, OWNER).stripeSubscriptionId,
    ).toBeNull()
  })
})
