/**
 * The single definition of "a transaction that still counts".
 *
 * Hiding is a read-path concern that reaches well beyond the transactions
 * table: the stat cards, the monthly chart, the category breakdown, project
 * profitability and the daily actions all sum the same rows. A hidden row that
 * kept counting in any one of them would put two different numbers for the same
 * money on screen at once, so every query spreads this rather than writing its
 * own `hiddenAt: null` and risking one being forgotten.
 */
export const VISIBLE_TRANSACTION = { hiddenAt: null } as const
