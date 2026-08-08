export type SerializedTransaction = {
  id: string
  ownerId: string
  type: string
  source: string
  amount: number
  currency: string
  description: string | null
  category: string
  occurredAt: string
  clientId: string | null
  projectId: string | null
  clientName: string | null   // derived from join; null when not included
  projectTitle: string | null // derived from join; null when not included
  externalId: string | null
  externalType: string | null
  isRecurring: boolean
  frequency: string | null
  /** YYYY-MM-DD, or null while the standing charge is still running. */
  recurrenceEndedAt: string | null
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

type TransactionRow = {
  id: string
  ownerId: string
  type: string
  source: string
  amount: { toNumber?: () => number } | number
  currency: string
  description: string | null
  category: string
  occurredAt: Date
  clientId: string | null
  projectId: string | null
  externalId: string | null
  externalType: string | null
  isRecurring: boolean
  frequency: string | null
  recurrenceEndedAt?: Date | string | null
  metadata: unknown
  createdAt: Date
  updatedAt: Date
  client?: { companyName: string | null; contactName: string | null } | null
  project?: { title: string } | null
}

export function serializeTransaction(t: TransactionRow): SerializedTransaction {
  return {
    id: t.id,
    ownerId: t.ownerId,
    type: t.type,
    source: t.source,
    amount:
      typeof t.amount === 'number'
        ? t.amount
        : (t.amount as { toNumber: () => number }).toNumber(),
    currency: t.currency,
    description: t.description,
    category: t.category,
    occurredAt: t.occurredAt.toISOString(),
    clientId: t.clientId,
    projectId: t.projectId,
    clientName: t.client
      ? (t.client.companyName ?? t.client.contactName ?? 'Unknown')
      : null,
    projectTitle: t.project?.title ?? null,
    externalId: t.externalId,
    externalType: t.externalType,
    isRecurring: t.isRecurring,
    frequency: t.frequency,
    recurrenceEndedAt: t.recurrenceEndedAt
      ? (t.recurrenceEndedAt instanceof Date
          ? t.recurrenceEndedAt.toISOString().slice(0, 10)
          : String(t.recurrenceEndedAt).slice(0, 10))
      : null,
    metadata: (t.metadata ?? {}) as Record<string, unknown>,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}
