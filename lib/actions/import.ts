'use server'

import { revalidatePath } from 'next/cache'
import { getOwnerId } from '@/lib/auth'
import { createClient } from '@/lib/clients'
import { createClientSchema } from '@/lib/clients/validators'

export type ImportRow = Record<string, string>
export type ImportResult = {
  imported: number
  skipped: number
  errors: Array<{ row: number; message: string }>
}

const MAX_ROWS = 500

/** Normalise a date string to YYYY-MM-DD, accepting both YYYY-MM-DD and MM/DD/YYYY. */
function normalizeDate(s: string): string | undefined {
  const t = s.trim()
  if (!t) return undefined
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const mdy = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, '0')}-${mdy[2].padStart(2, '0')}`
  return undefined
}

/** Strip non-numeric characters except decimal point from a currency/number string. */

/**
 * Imports a batch of pre-mapped rows into the clients table.
 * Keys in each row must match client field names (e.g. "companyName", "email").
 * Invalid rows are skipped; a summary with per-row errors is returned.
 */
export async function importClientsAction(rows: ImportRow[]): Promise<ImportResult> {
  const ownerId = await getOwnerId()

  if (rows.length > MAX_ROWS) {
    return {
      imported: 0,
      skipped: rows.length,
      errors: [{ row: 0, message: `Too many rows — max ${MAX_ROWS} per import` }],
    }
  }

  let imported = 0
  const errors: Array<{ row: number; message: string }> = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    const rowNum = i + 2 // account for 1-based indexing + header row

    // Skip blank rows silently
    if (!Object.values(row).some((v) => v.trim())) continue

    // At least one identifying field is required
    if (!row.companyName?.trim() && !row.contactName?.trim() && !row.email?.trim()) {
      errors.push({
        row: rowNum,
        message: 'Requires at least one of: company name, contact name, email',
      })
      continue
    }

    const data: Record<string, unknown> = {}
    const str = (v?: string) => v?.trim() || undefined

    if (str(row.companyName)) data.companyName = str(row.companyName)
    if (str(row.contactName)) data.contactName = str(row.contactName)
    if (str(row.email)) data.email = str(row.email)
    if (str(row.phone)) data.phone = str(row.phone)
    if (str(row.website)) data.website = str(row.website)
    if (str(row.industry)) data.industry = str(row.industry)
    if (str(row.companySize)) data.companySize = str(row.companySize)
    if (str(row.leadSource)) data.leadSource = str(row.leadSource)

    // Status, project type and estimated value are no longer client fields:
    // a client's stage is read off their projects, and the work itself is
    // described by projects.title, projects.deliverables and projects.budget.
    // All three columns were dropped from the importer's list to match, so a
    // CSV carrying them has nowhere for them to land.

    // Date fields — accept YYYY-MM-DD or MM/DD/YYYY
    if (str(row.lastContactDate)) {
      const d = normalizeDate(row.lastContactDate)
      if (d) data.lastContactDate = d
    }
    if (str(row.nextFollowupDate)) {
      const d = normalizeDate(row.nextFollowupDate)
      if (d) data.nextFollowupDate = d
    }

    const parsed = createClientSchema.safeParse(data)
    if (!parsed.success) {
      errors.push({ row: rowNum, message: parsed.error.issues[0].message })
      continue
    }

    try {
      await createClient(ownerId, parsed.data)
      imported++
    } catch {
      errors.push({ row: rowNum, message: 'Database error — row not imported' })
    }
  }

  if (imported > 0) revalidatePath('/clients')
  return { imported, skipped: errors.length, errors }
}
