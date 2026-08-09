import type { ClientStage } from './stage'

/**
 * Client status was removed: a stage is derived from the client's projects and
 * contact history instead. See lib/clients/stage.ts for why.
 */
export interface ClientFilters {
  /** Filter to a derived stage. */
  stage?: ClientStage
  /** Case-insensitive substring match on company name, contact name, or email */
  q?: string
  /** Filter by tag label (case-insensitive) */
  tag?: string
  /** Include only clients with no contact in the last N days */
  stale?: number
  /** Include archived clients (defaults to false = active only) */
  archived?: boolean
}
