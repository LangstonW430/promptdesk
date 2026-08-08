import { describe, it, expect } from 'vitest'
import { serializeInvoice, type InvoiceRow } from '@/lib/invoices/serialize'

/**
 * `dueDate` is a Postgres DATE, so Prisma hands it back as midnight UTC. Read
 * as an instant, "due on the 8th" became "late from 00:00 on the 8th" — a
 * client opening the link on the morning it fell due saw a red OVERDUE chip.
 * A due date is a whole day; it is not late until that day is over.
 */

const row = (overrides: Partial<InvoiceRow> = {}): InvoiceRow => ({
  id: 'i1',
  ownerId: 'o1',
  invoiceNumber: 1,
  publicToken: 'tok',
  clientId: 'c1',
  projectId: null,
  lineItems: [],
  status: 'sent',
  issueDate: new Date('2026-08-01T00:00:00.000Z'),
  dueDate: new Date('2026-08-08T00:00:00.000Z'),
  subtotal: 100,
  tax: null,
  total: 100,
  notes: null,
  transactionId: null,
  isArchived: false,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  client: { companyName: 'Acme', contactName: null },
  project: null,
  ...overrides,
})

const statusAt = (iso: string, overrides?: Partial<InvoiceRow>) =>
  serializeInvoice(row(overrides), new Date(iso)).status

describe('derived invoice status', () => {
  it('is still sent at the start of the due date', () => {
    expect(statusAt('2026-08-08T00:00:00.000Z')).toBe('sent')
  })

  it('is still sent during the due date', () => {
    expect(statusAt('2026-08-08T14:30:00.000Z')).toBe('sent')
  })

  it('is still sent at the last moment of the due date', () => {
    expect(statusAt('2026-08-08T23:59:59.000Z')).toBe('sent')
  })

  it('becomes overdue once the due date has passed', () => {
    expect(statusAt('2026-08-09T00:00:00.000Z')).toBe('overdue')
  })

  it('is overdue well after the due date', () => {
    expect(statusAt('2026-09-01T09:00:00.000Z')).toBe('overdue')
  })

  it('is sent well before the due date', () => {
    expect(statusAt('2026-08-02T09:00:00.000Z')).toBe('sent')
  })

  it('never promotes a draft', () => {
    expect(statusAt('2026-09-01T00:00:00.000Z', { status: 'draft' })).toBe('draft')
  })

  it('never demotes a paid invoice, however late', () => {
    expect(statusAt('2026-12-01T00:00:00.000Z', { status: 'paid' })).toBe('paid')
  })

  it('leaves a manually set overdue alone', () => {
    expect(statusAt('2026-08-02T00:00:00.000Z', { status: 'overdue' })).toBe('overdue')
  })
})
