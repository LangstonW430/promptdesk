export type SerializedTimeEntry = {
  id:           string
  clientId:     string
  clientName:   string
  projectId:    string | null
  projectTitle: string | null
  date:         string  // "YYYY-MM-DD"
  hours:        number
  rate:         number | null
  description:  string | null
  isBillable:   boolean
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
  clientId:    string
  projectId:   string | null
  date:        Date | string
  hours:       DecimalLike
  rate:        DecimalLike
  description: string | null
  isBillable:  boolean
  createdAt:   Date | string
  client:      { companyName: string | null; contactName: string | null }
  project:     { title: string } | null
}

export function serializeTimeEntry(row: TimeEntryRow): SerializedTimeEntry {
  const dateStr =
    row.date instanceof Date
      ? row.date.toISOString().slice(0, 10)
      : String(row.date).slice(0, 10)

  return {
    id:           row.id,
    clientId:     row.clientId,
    clientName:   row.client.companyName ?? row.client.contactName ?? 'Unknown',
    projectId:    row.projectId,
    projectTitle: row.project?.title ?? null,
    date:         dateStr,
    hours:        toNum(row.hours) ?? 0,
    rate:         toNum(row.rate),
    description:  row.description,
    isBillable:   row.isBillable,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  }
}
