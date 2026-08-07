export type SerializedTimeEntry = {
  id:           string
  projectId:    string
  projectTitle: string
  clientName:   string
  date:         string  // "YYYY-MM-DD"
  hours:        number
  rate:         number | null
  description:  string | null
  isBillable:   boolean
  /** Set once the entry has been rolled into an invoice. */
  invoiceId:    string | null
  createdAt:    string  // ISO 8601
}

type DecimalLike = { toNumber(): number } | number | null | undefined

function toNum(d: DecimalLike): number | null {
  if (d == null) return null
  if (typeof d === 'number') return d
  return d.toNumber()
}

type TimeEntryRow = {
  id:          string
  projectId:   string
  date:        Date | string
  hours:       DecimalLike
  rate:        DecimalLike
  description: string | null
  isBillable:  boolean
  invoiceId?:  string | null
  createdAt:   Date | string
  project: {
    title:  string
    client: { companyName: string | null; contactName: string | null }
  }
}

export function serializeTimeEntry(row: TimeEntryRow): SerializedTimeEntry {
  const dateStr =
    row.date instanceof Date
      ? row.date.toISOString().slice(0, 10)
      : String(row.date).slice(0, 10)

  return {
    id:           row.id,
    projectId:    row.projectId,
    projectTitle: row.project.title,
    clientName:   row.project.client.companyName ?? row.project.client.contactName ?? 'Unknown',
    date:         dateStr,
    hours:        toNum(row.hours) ?? 0,
    rate:         toNum(row.rate),
    description:  row.description,
    isBillable:   row.isBillable,
    invoiceId:    row.invoiceId ?? null,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  }
}
