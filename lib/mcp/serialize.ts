/**
 * The Prisma → JSON boundary for everything the MCP server returns.
 *
 * Two conversions, both of which have a wrong answer that is easy to reach for:
 *
 * **Decimal → string, not number.** `transactions.amount` and
 * `projects.budget` are `DECIMAL(12,2)`. Turning one into a JS `number` is
 * lossless at these magnitudes today and silently is not at some larger one,
 * and nothing downstream would notice. A string carries the exact value the
 * database holds. Figures that have already been *computed* server-side
 * (`ProjectFinancials` sums them in JS and returns `number`) stay numbers —
 * re-stringifying a number would imply a precision it no longer has.
 *
 * **Date → ISO 8601.** `JSON.stringify` would do this anyway; doing it here
 * means the tool's declared output type says `string`, so nothing can
 * accidentally hand a `Date` to a zod `outputSchema` and have it validate.
 *
 * Note for whoever consolidates: this is the sixth private copy of the
 * Decimal shim in this repo (the others are in `lib/clients/serialize.ts`,
 * `lib/invoices/serialize.ts`, `lib/finance/serialize.ts`,
 * `lib/time-entries/serialize.ts` and `lib/prompt-engine/normalizer.ts`).
 * It is separate rather than shared because it converts to a different type
 * than all five of those, which return `number | null`.
 */

/**
 * Structurally typed rather than importing Prisma's `Decimal`, matching the
 * convention in `lib/prompt-engine/normalizer.ts`: it keeps this module
 * importable from a test without generating a Prisma client first.
 */
export type DecimalLike = { toString(): string } | number | null | undefined

/** A `DECIMAL` column as an exact decimal string, or null. */
export function toDecimalString(value: DecimalLike): string | null {
  if (value == null) return null
  return typeof value === 'number' ? String(value) : value.toString()
}

/** A timestamp as ISO 8601, or null. */
export function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null
}

/**
 * A `DATE` column as `YYYY-MM-DD`.
 *
 * Due dates, invoice dates and contact dates are `@db.Date` — a calendar day
 * with no time and no zone. Prisma hands them back as a `Date` at UTC
 * midnight, so the full ISO form would append `T00:00:00.000Z` and invite a
 * reader to shift it into a timezone and land on the previous day. Ten
 * characters say what the column actually stores.
 */
export function toDateOnly(value: Date | null | undefined): string | null {
  return value ? value.toISOString().slice(0, 10) : null
}
