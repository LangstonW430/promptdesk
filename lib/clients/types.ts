export const CLIENT_STATUSES = [
  'lead',
  'contacted',
  'proposal_sent',
  'negotiating',
  'won',
  'lost',
] as const

export type ClientStatus = (typeof CLIENT_STATUSES)[number]

export interface ClientFilters {
  status?: ClientStatus
  /** Case-insensitive substring match on company name, contact name, or email */
  q?: string
  /** Filter by tag label (case-insensitive) */
  tag?: string
  /** Include only clients with no contact in the last N days */
  stale?: number
  /** Include archived clients (defaults to false = active only) */
  archived?: boolean
}
