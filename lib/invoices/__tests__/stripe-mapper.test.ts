import { describe, it, expect } from 'vitest'
import type Stripe from 'stripe'
import {
  toCents,
  toDollars,
  toInvoiceStatus,
  lineItemDescription,
  lineItemsToInvoiceItems,
  stripeLinesToLineItems,
  daysUntilDue,
  toInvoiceMirror,
  invoicePaymentIntentId,
  isEditable,
  isSettled,
} from '../stripe-mapper'
import type { LineItem } from '../types'

const line = (overrides: Partial<LineItem> = {}): LineItem => ({
  id: 'l1',
  description: 'Design work',
  quantity: 1,
  unitPrice: 100,
  amount: 100,
  ...overrides,
})

function makeInvoice(overrides: Record<string, unknown> = {}): Stripe.Invoice {
  return {
    id: 'in_test',
    object: 'invoice',
    status: 'open',
    number: 'ABCD-0001',
    customer: 'cus_test',
    hosted_invoice_url: 'https://invoice.stripe.com/i/test',
    invoice_pdf: 'https://pay.stripe.com/invoice/test/pdf',
    subtotal: 10_000,
    total: 10_850,
    total_taxes: [{ amount: 850 }],
    due_date: 1_754_611_200, // 2025-08-08T00:00:00Z
    lines: {
      object: 'list',
      data: [
        { id: 'il_1', description: 'Design work', amount: 10_000 },
      ],
      has_more: false,
    },
    ...overrides,
  } as unknown as Stripe.Invoice
}

describe('money conversion', () => {
  it('converts dollars to cents', () => {
    expect(toCents(100)).toBe(10_000)
  })

  // Floating point makes 0.07 * 100 land on 7.000000000000001 and 8.2 * 100 on
  // 819.9999999999999. Truncating those would bill a cent short on every line
  // carrying one.
  it('rounds rather than truncates', () => {
    expect(toCents(8.5)).toBe(850)
    expect(toCents(0.07)).toBe(7)
    expect(toCents(8.2)).toBe(820)
    expect(toCents(1234.56)).toBe(123_456)
  })

  it('round-trips back to dollars', () => {
    expect(toDollars(toCents(1234.56))).toBe(1234.56)
  })
})

describe('toInvoiceStatus', () => {
  it.each(['draft', 'open', 'paid', 'uncollectible', 'void'] as const)(
    'passes through %s',
    (status) => {
      expect(toInvoiceStatus(status)).toBe(status)
    },
  )

  // Stripe types status as nullable and could add a value we do not know.
  // Draft is the only state with no financial consequence, so an unrecognised
  // one lands there rather than being guessed at — and never on 'paid'.
  it('falls back to draft for null', () => {
    expect(toInvoiceStatus(null)).toBe('draft')
  })

  it('falls back to draft for a status it does not know', () => {
    expect(toInvoiceStatus('deleted' as Stripe.Invoice['status'])).toBe('draft')
  })
})

describe('lineItemDescription', () => {
  it('uses the description alone at a quantity of one', () => {
    expect(lineItemDescription(line())).toBe('Design work')
  })

  // Stripe requires an integer quantity and ours are hours, so the arithmetic
  // is spelled out in the description instead of being rounded away.
  it('spells out fractional quantities', () => {
    expect(
      lineItemDescription(line({ quantity: 2.5, unitPrice: 80, amount: 200 })),
    ).toBe('Design work (2.5 × $80.00)')
  })

  it('does not pad the quantity with trailing zeros', () => {
    expect(
      lineItemDescription(line({ quantity: 3, unitPrice: 50, amount: 150 })),
    ).toBe('Design work (3 × $50.00)')
  })
})

describe('lineItemsToInvoiceItems', () => {
  it('carries the exact line total in cents', () => {
    const items = lineItemsToInvoiceItems([
      line({ quantity: 2.5, unitPrice: 80, amount: 200 }),
    ])
    expect(items).toEqual([
      { amount: 20_000, currency: 'usd', description: 'Design work (2.5 × $80.00)' },
    ])
  })

  it('maps one item per line', () => {
    const items = lineItemsToInvoiceItems([
      line({ id: 'a', description: 'A' }),
      line({ id: 'b', description: 'B' }),
    ])
    expect(items).toHaveLength(2)
  })

  // A line billed at no charge is something freelancers deliberately show a
  // client. Dropping it would silently edit the document.
  it('keeps zero-amount lines', () => {
    const items = lineItemsToInvoiceItems([
      line({ description: 'Discovery call (no charge)', amount: 0, unitPrice: 0 }),
    ])
    expect(items).toHaveLength(1)
    expect(items[0].amount).toBe(0)
  })

  it('bills the sum of the lines, not a rounded total', () => {
    const items = lineItemsToInvoiceItems([
      line({ quantity: 1.5, unitPrice: 33.33, amount: 50 }),
      line({ quantity: 0.25, unitPrice: 33.33, amount: 8.33 }),
    ])
    expect(items.reduce((s, i) => s + i.amount, 0)).toBe(5833)
  })
})

describe('daysUntilDue', () => {
  it('counts whole days between issue and due', () => {
    expect(
      daysUntilDue(new Date('2026-08-01T00:00:00Z'), new Date('2026-08-31T00:00:00Z')),
    ).toBe(30)
  })

  // Stripe rejects a negative count outright, and an invoice cannot fall due
  // before it is issued.
  it('never returns a negative count', () => {
    expect(
      daysUntilDue(new Date('2026-08-10T00:00:00Z'), new Date('2026-08-01T00:00:00Z')),
    ).toBe(0)
  })

  it('is zero when due on the issue date', () => {
    expect(
      daysUntilDue(new Date('2026-08-01T00:00:00Z'), new Date('2026-08-01T00:00:00Z')),
    ).toBe(0)
  })

  // Rounded up, so an invoice due "tomorrow" does not become due today.
  it('rounds a part-day up', () => {
    expect(
      daysUntilDue(new Date('2026-08-01T18:00:00Z'), new Date('2026-08-02T09:00:00Z')),
    ).toBe(1)
  })
})

describe('toInvoiceMirror', () => {
  it('maps the fields Stripe owns', () => {
    const mirror = toInvoiceMirror(makeInvoice())
    expect(mirror).toMatchObject({
      stripeInvoiceId: 'in_test',
      stripeCustomerId: 'cus_test',
      number: 'ABCD-0001',
      hostedInvoiceUrl: 'https://invoice.stripe.com/i/test',
      status: 'open',
      subtotal: 100,
      tax: 8.5,
      total: 108.5,
    })
  })

  it('unwraps an expanded customer object to its id', () => {
    const mirror = toInvoiceMirror(
      makeInvoice({ customer: { id: 'cus_expanded', object: 'customer' } }),
    )
    expect(mirror.stripeCustomerId).toBe('cus_expanded')
  })

  // An invoice can carry several tax components at once, so the single figure
  // our column holds is their sum.
  it('sums multiple tax components', () => {
    const mirror = toInvoiceMirror(
      makeInvoice({ total_taxes: [{ amount: 500 }, { amount: 250 }] }),
    )
    expect(mirror.tax).toBe(7.5)
  })

  // No tax is not the same as zero tax: one means the invoice is untaxed, the
  // other that a rate applied and came to nothing.
  it('reports no tax as null', () => {
    expect(toInvoiceMirror(makeInvoice({ total_taxes: null })).tax).toBeNull()
    expect(toInvoiceMirror(makeInvoice({ total_taxes: [] })).tax).toBeNull()
  })

  // Trusting Stripe's own total rather than recomputing subtotal + tax, which
  // would disagree the moment a discount or credit is applied on their side.
  it('takes the total from Stripe rather than recomputing it', () => {
    const mirror = toInvoiceMirror(
      makeInvoice({ subtotal: 10_000, total_taxes: [{ amount: 850 }], total: 9_000 }),
    )
    expect(mirror.total).toBe(90)
  })

  it('converts the due date from Unix seconds', () => {
    expect(toInvoiceMirror(makeInvoice()).dueDate?.toISOString()).toBe(
      '2025-08-08T00:00:00.000Z',
    )
  })

  it('reports no due date as null', () => {
    expect(toInvoiceMirror(makeInvoice({ due_date: null })).dueDate).toBeNull()
  })

  it('mirrors the line items Stripe reports', () => {
    expect(toInvoiceMirror(makeInvoice()).lineItems).toEqual([
      { id: 'il_1', description: 'Design work', quantity: 1, unitPrice: 100, amount: 100 },
    ])
  })

  it('handles an invoice with no lines', () => {
    const mirror = toInvoiceMirror(makeInvoice({ lines: { object: 'list', data: [] } }))
    expect(mirror.lineItems).toEqual([])
  })
})

describe('stripeLinesToLineItems', () => {
  it('falls back to an index-based id when a line has none', () => {
    const items = stripeLinesToLineItems(
      makeInvoice({
        lines: { object: 'list', data: [{ description: 'X', amount: 500 }] },
      }),
    )
    expect(items[0].id).toBe('line-0')
  })

  it('treats a missing description as empty rather than dropping the line', () => {
    const items = stripeLinesToLineItems(
      makeInvoice({
        lines: { object: 'list', data: [{ id: 'il_1', amount: 500 }] },
      }),
    )
    expect(items).toHaveLength(1)
    expect(items[0].description).toBe('')
  })
})

describe('invoicePaymentIntentId', () => {
  // The key that stops one card payment being banked twice. `charge.succeeded`
  // records income against the payment intent; without this, `invoice.paid`
  // would record the same money against the invoice id instead.
  it('finds the intent on the invoice payment', () => {
    const invoice = makeInvoice({
      payments: {
        object: 'list',
        data: [{ payment: { type: 'payment_intent', payment_intent: 'pi_123' } }],
      },
    })
    expect(invoicePaymentIntentId(invoice)).toBe('pi_123')
  })

  it('unwraps an expanded payment intent to its id', () => {
    const invoice = makeInvoice({
      payments: {
        object: 'list',
        data: [
          {
            payment: {
              type: 'payment_intent',
              payment_intent: { id: 'pi_expanded', object: 'payment_intent' },
            },
          },
        ],
      },
    })
    expect(invoicePaymentIntentId(invoice)).toBe('pi_expanded')
  })

  it('skips payment entries that carry no intent', () => {
    const invoice = makeInvoice({
      payments: {
        object: 'list',
        data: [
          { payment: { type: 'payment_record' } },
          { payment: { type: 'payment_intent', payment_intent: 'pi_456' } },
        ],
      },
    })
    expect(invoicePaymentIntentId(invoice)).toBe('pi_456')
  })

  // An invoice settled by bank transfer, or marked paid in the dashboard, has
  // no intent at all — and no charge event to collide with, so keying on the
  // invoice id is correct there.
  it('returns null for an out-of-band payment', () => {
    const invoice = makeInvoice({
      payments: { object: 'list', data: [{ payment: { type: 'payment_record' } }] },
    })
    expect(invoicePaymentIntentId(invoice)).toBeNull()
  })

  it('returns null when the invoice has no payments at all', () => {
    expect(invoicePaymentIntentId(makeInvoice())).toBeNull()
    expect(invoicePaymentIntentId(makeInvoice({ payments: undefined }))).toBeNull()
  })
})

describe('lifecycle predicates', () => {
  // Once finalized, Stripe permits changing almost nothing, so the UI must not
  // offer an edit that would fail at the API.
  it('allows editing only a draft', () => {
    expect(isEditable('draft')).toBe(true)
    expect(isEditable('open')).toBe(false)
    expect(isEditable('paid')).toBe(false)
    expect(isEditable('void')).toBe(false)
    expect(isEditable('uncollectible')).toBe(false)
  })

  it('treats only paid as settled', () => {
    expect(isSettled('paid')).toBe(true)
    expect(isSettled('open')).toBe(false)
    expect(isSettled('uncollectible')).toBe(false)
    expect(isSettled('void')).toBe(false)
  })
})
