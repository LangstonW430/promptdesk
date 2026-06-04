/**
 * Pure Stripe → Transaction mapper. No I/O — pass data in, get a plain object out.
 *
 * Revenue recognition convention (do NOT change without updating stripe-sync.ts):
 *   - chargeToTransaction  → income row for the gross charge amount
 *   - chargeFeeToTransaction → expense row for the Stripe processing fee
 *   - refundToTransaction  → expense row for the refunded amount
 *
 * Payouts and balance transfers are intentionally excluded. They represent
 * the same charge money moving to your bank account; counting them would
 * double revenue in the P&L totals.
 *
 * PCI: only card last4 and brand are stored. Full card numbers and raw bank
 * details are never persisted.
 */

import type Stripe from 'stripe'

// ─── Output shape ──────────────────────────────────────────────────────────────

export type StripeTransactionData = {
  ownerId: string
  type: 'income' | 'expense'
  source: 'stripe'
  amount: number           // always positive, in account currency units (e.g. dollars)
  currency: string         // ISO lower-case, e.g. "usd"
  description: string | null
  category: string
  occurredAt: Date
  clientId: null           // set later by the sync engine via email matching
  externalId: string       // Stripe object id or compound key (charge.id + ":fee")
  externalType: 'charge' | 'fee' | 'refund' | 'invoice'
  metadata: Record<string, unknown>
}

// ─── Type guards for expanded objects ─────────────────────────────────────────

function isExpandedBalanceTx(
  bt: Stripe.Charge['balance_transaction'],
): bt is Stripe.BalanceTransaction {
  return typeof bt === 'object' && bt !== null && 'fee' in bt
}

function isExpandedCustomer(
  c: Stripe.Charge['customer'],
): c is Stripe.Customer {
  return (
    typeof c === 'object' &&
    c !== null &&
    (c as { deleted?: unknown }).deleted !== true
  )
}

// ─── Counterparty extraction ──────────────────────────────────────────────────

function extractCounterparty(charge: Stripe.Charge): {
  name: string | null
  email: string | null
  stripeCustomerId: string | null
  last4: string | null
  brand: string | null
} {
  const billingName = charge.billing_details?.name ?? null
  const billingEmail = charge.billing_details?.email ?? null

  const customer = charge.customer
  const customerEmail = isExpandedCustomer(customer) ? (customer.email ?? null) : null
  const stripeCustomerId =
    typeof customer === 'string'
      ? customer
      : isExpandedCustomer(customer)
        ? customer.id
        : null

  // PCI: last4 and brand only — never card numbers or raw bank details
  const card = charge.payment_method_details?.card
  const last4 = card?.last4 ?? null
  const brand = card?.brand ?? null

  return {
    name: billingName,
    email: billingEmail ?? customerEmail,
    stripeCustomerId,
    last4,
    brand,
  }
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

/**
 * Maps a succeeded Stripe charge to an income transaction row.
 * Amount is the gross charge (before Stripe fee deduction).
 */
export function chargeToTransaction(
  charge: Stripe.Charge,
  ownerId: string,
): StripeTransactionData {
  const counterparty = extractCounterparty(charge)
  return {
    ownerId,
    type: 'income',
    source: 'stripe',
    amount: charge.amount / 100,
    currency: charge.currency.toLowerCase(),
    description: charge.description ?? null,
    category: 'Stripe payment',
    occurredAt: new Date(charge.created * 1000),
    clientId: null,
    externalId: charge.id,
    externalType: 'charge',
    metadata: {
      counterpartyName: counterparty.name,
      counterpartyEmail: counterparty.email,
      stripeCustomerId: counterparty.stripeCustomerId,
      last4: counterparty.last4,
      brand: counterparty.brand,
    },
  }
}

/**
 * Maps the Stripe processing fee for a charge to an expense transaction row.
 * Returns null when the balance_transaction is not expanded or fee is zero.
 *
 * Using a compound externalId (chargeId + ":fee") keeps the fee idempotently
 * linked to its source charge while satisfying the unique constraint.
 */
export function chargeFeeToTransaction(
  charge: Stripe.Charge,
  ownerId: string,
): StripeTransactionData | null {
  const bt = charge.balance_transaction
  if (!isExpandedBalanceTx(bt)) return null
  if (bt.fee <= 0) return null

  return {
    ownerId,
    type: 'expense',
    source: 'stripe',
    amount: bt.fee / 100,
    currency: charge.currency.toLowerCase(),
    description: `Stripe fee for ${charge.id}`,
    category: 'Stripe fees',
    occurredAt: new Date(charge.created * 1000),
    clientId: null,
    externalId: `${charge.id}:fee`,
    externalType: 'fee',
    metadata: {
      chargeId: charge.id,
      feeDetails: bt.fee_details ?? [],
    },
  }
}

/**
 * Maps a paid Stripe Invoice to an income row.
 *
 * Only call this when invoice.charge is null (no backing charge object).
 * When invoice.charge is set, charge.succeeded fires too — use chargeToTransaction
 * for that path and skip this mapper to avoid double-counting.
 */
export function invoiceToTransaction(
  invoice: Stripe.Invoice,
  ownerId: string,
): StripeTransactionData {
  const customerEmail =
    typeof invoice.customer_email === 'string' ? invoice.customer_email : null
  const customerName =
    typeof invoice.customer_name === 'string' ? invoice.customer_name : null
  const stripeCustomerId =
    typeof invoice.customer === 'string' ? invoice.customer : null

  return {
    ownerId,
    type: 'income',
    source: 'stripe',
    amount: invoice.amount_paid / 100,
    currency: invoice.currency.toLowerCase(),
    description: invoice.description ?? null,
    category: 'Stripe payment',
    occurredAt: new Date(invoice.created * 1000),
    clientId: null,
    externalId: invoice.id!,
    externalType: 'invoice',
    metadata: {
      counterpartyName: customerName,
      counterpartyEmail: customerEmail,
      stripeCustomerId,
      invoiceNumber: invoice.number ?? null,
    },
  }
}

/**
 * Maps a Stripe refund to an expense transaction row.
 *
 * Convention: refunds are recorded as expense rows (positive amount, type =
 * "expense"). Combined with the original income row they net to the correct
 * P&L effect: income $100 + expense $100 = $0 net for a full refund.
 */
export function refundToTransaction(
  refund: Stripe.Refund,
  charge: Stripe.Charge,
  ownerId: string,
): StripeTransactionData {
  return {
    ownerId,
    type: 'expense',
    source: 'stripe',
    amount: refund.amount / 100,
    currency: refund.currency.toLowerCase(),
    description: `Refund for ${charge.id}`,
    category: 'Other expense',
    occurredAt: new Date(refund.created * 1000),
    clientId: null,
    externalId: refund.id,
    externalType: 'refund',
    metadata: {
      chargeId: charge.id,
      reason: refund.reason ?? null,
    },
  }
}
