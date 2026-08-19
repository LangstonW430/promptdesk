import { describe, it, expect } from 'vitest'
import { serializeInvoice, type InvoiceRow } from '@/lib/invoices/serialize'

/**
 * Overdue is derived, and is no longer a status.
 *
 * Stripe's lifecycle has no overdue state — an unpaid invoice past its due date
 * is still `open` — so it is reported as a flag alongside the status rather than
 * replacing it.
 *
 * `dueDate` is a Postgres DATE, so Prisma hands it back as midnight UTC. Read as
 * an instant, "due on the 8th" became "late from 00:00 on the 8th" — a client
 * opening the link on the morning it fell due saw a red OVERDUE chip. A due date
 * is a whole day; it is not late until that day is over.
 */

const row = (overrides: Partial<InvoiceRow> = {}): InvoiceRow => ({
  id: 'i1',
  ownerId: 'o1',
  stripeInvoiceId: 'in_1',
  number: 'ABCD-0001',
  hostedInvoiceUrl: 'https://invoice.stripe.com/i/test',
  invoicePdf: null,
  invoiceNumber: null,
  publicToken: null,
  clientId: 'c1',
  projectId: null,
  lineItems: [],
  status: 'open',
  issueDate: new Date('2026-08-01T00:00:00.000Z'),
  dueDate: new Date('2026-08-08T00:00:00.000Z'),
  subtotal: 100,
  tax: null,
  taxRate: null,
  total: 100,
  paymentTerms: null,
  purchaseOrder: null,
  notes: null,
  transactionId: null,
  isArchived: false,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  client: { companyName: 'Acme', contactName: null, address: null },
  project: null,
  ...overrides,
})

const overdueAt = (iso: string, overrides?: Partial<InvoiceRow>) =>
  serializeInvoice(row(overrides), new Date(iso)).isOverdue

describe('derived overdue flag', () => {
  it('is not overdue at the start of the due date', () => {
    expect(overdueAt('2026-08-08T00:00:00.000Z')).toBe(false)
  })

  it('is not overdue during the due date', () => {
    expect(overdueAt('2026-08-08T14:30:00.000Z')).toBe(false)
  })

  it('is not overdue at the last moment of the due date', () => {
    expect(overdueAt('2026-08-08T23:59:59.000Z')).toBe(false)
  })

  it('becomes overdue once the due date has passed', () => {
    expect(overdueAt('2026-08-09T00:00:00.000Z')).toBe(true)
  })

  it('is overdue well after the due date', () => {
    expect(overdueAt('2026-09-01T09:00:00.000Z')).toBe(true)
  })

  it('is not overdue well before the due date', () => {
    expect(overdueAt('2026-08-02T09:00:00.000Z')).toBe(false)
  })

  // Only an open invoice can be late. A draft was never sent, and the rest are
  // closed — nobody owes anything on a paid, voided or written-off invoice.
  it('never flags a draft', () => {
    expect(overdueAt('2026-09-01T00:00:00.000Z', { status: 'draft' })).toBe(false)
  })

  it('never flags a paid invoice, however late it was', () => {
    expect(overdueAt('2026-12-01T00:00:00.000Z', { status: 'paid' })).toBe(false)
  })

  it('never flags a voided invoice', () => {
    expect(overdueAt('2026-12-01T00:00:00.000Z', { status: 'void' })).toBe(false)
  })

  it('never flags one written off as uncollectible', () => {
    expect(overdueAt('2026-12-01T00:00:00.000Z', { status: 'uncollectible' })).toBe(false)
  })

  it('leaves the status itself untouched', () => {
    expect(serializeInvoice(row(), new Date('2026-09-01T00:00:00.000Z')).status).toBe('open')
  })
})

describe('invoice numbering', () => {
  it('uses the number Stripe assigned', () => {
    expect(serializeInvoice(row()).number).toBe('ABCD-0001')
  })

  // Stripe assigns the number at finalization, so a draft genuinely has none.
  it('reports no number for a draft Stripe has not finalized', () => {
    expect(serializeInvoice(row({ status: 'draft', number: null })).number).toBeNull()
  })

  // Legacy rows keep showing the reference printed on the copy the client holds.
  it('falls back to the legacy INV- number when there is no Stripe invoice', () => {
    const legacy = serializeInvoice(
      row({ stripeInvoiceId: null, number: null, invoiceNumber: 7 }),
    )
    expect(legacy.number).toBe('INV-0007')
    expect(legacy.isLegacy).toBe(true)
  })

  it('marks a Stripe-backed invoice as not legacy', () => {
    expect(serializeInvoice(row()).isLegacy).toBe(false)
  })
})
