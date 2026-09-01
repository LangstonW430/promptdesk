/**
 * How a standing charge describes itself in the ledger.
 *
 * A standing charge is one row, dated the month it began; every later month is
 * an occurrence `expandRecurring` computes on read. The table used to say so —
 * the starting month read "Monthly" and each repeat "Monthly · repeat" — which
 * put a distinction the user has no stake in right where a state they do care
 * about should be. One subscription wore two labels down the same column, and
 * whether it was still being charged showed up only as a missing button.
 *
 * So the label answers the question the ledger cannot: is this charge still
 * running, and if not, when did it stop. Which month holds the underlying row
 * is a detail of storage and belongs in the tooltip.
 */

/** The fields of a ledger row this label reads; see `expandRecurring`. */
export type RecurrenceLabelRow = {
  /** The occurrence's date — the projected one on a repeat. */
  occurredAt: string
  frequency?: string | null
  /** `YYYY-MM-DD`. Set means the charge has stopped. */
  recurrenceEndedAt?: string | null
  isProjected?: boolean
  /** The date of the row behind the occurrence. */
  seriesStartAt?: string
}

export type RecurrenceLabel = {
  /** Badge text, e.g. `Monthly` or `Monthly · ended Aug 31`. */
  label: string
  /** Hover text carrying what the badge leaves out. */
  title: string
  /** Whether the charge has stopped — the badge tones itself down when it has. */
  ended: boolean
}

function formatFull(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * The end date as the badge shows it: month and day, with the year only when it
 * differs from the row's own. Every occurrence of an ended charge carries this
 * label, including ones from an earlier year, where a bare "ended Jan 31" would
 * read as a date that has not happened yet.
 */
function formatEndedOn(endedAt: string, occurredAt: string) {
  const sameYear = endedAt.slice(0, 4) === occurredAt.slice(0, 4)
  return new Date(endedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'UTC',
  })
}

/**
 * Stripe imports carry no cadence of their own — the mapper never writes one —
 * so an unrecognised frequency says only that the charge repeats. Claiming
 * "Monthly" there stated an annual subscription's billing period wrongly.
 */
function cadenceOf(frequency: string | null | undefined) {
  switch (frequency) {
    case 'quarterly':
      return 'Quarterly'
    case 'annual':
      return 'Annual'
    case 'monthly':
      return 'Monthly'
    default:
      return 'Recurring'
  }
}

export function recurrenceLabel(t: RecurrenceLabelRow): RecurrenceLabel {
  const cadence = cadenceOf(t.frequency)
  const startedAt = t.seriesStartAt ?? t.occurredAt
  const ended = Boolean(t.recurrenceEndedAt)

  const repeatNote = t.isProjected
    ? `This month is a repeat of the charge that began ${formatFull(startedAt)}; editing or stopping it here changes the charge itself.`
    : null

  const title = [
    t.recurrenceEndedAt
      ? `Standing charge — stopped on ${formatFull(t.recurrenceEndedAt)}.`
      : 'Standing charge — repeats every period.',
    repeatNote,
  ]
    .filter(Boolean)
    .join(' ')

  return {
    ended,
    title,
    label: t.recurrenceEndedAt
      ? `${cadence} · ended ${formatEndedOn(t.recurrenceEndedAt, t.occurredAt)}`
      : cadence,
  }
}
