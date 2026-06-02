'use client'

import { useState, useRef, useTransition } from 'react'
import { Upload, Download, AlertCircle, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { importClientsAction, type ImportRow, type ImportResult } from '@/lib/actions/import'

// ── Constants ──────────────────────────────────────────────────────────────

const CLIENT_FIELDS: Array<{ value: string; label: string }> = [
  { value: 'companyName',      label: 'Company name' },
  { value: 'contactName',      label: 'Contact name' },
  { value: 'email',            label: 'Email' },
  { value: 'phone',            label: 'Phone' },
  { value: 'website',          label: 'Website' },
  { value: 'industry',         label: 'Industry' },
  { value: 'companySize',      label: 'Company size' },
  { value: 'leadSource',       label: 'Lead source' },
  { value: 'status',           label: 'Status' },
  { value: 'estimatedValue',   label: 'Estimated value' },
  { value: 'projectType',      label: 'Project type' },
  { value: 'lastContactDate',  label: 'Last contact date' },
  { value: 'nextFollowupDate', label: 'Next follow-up date' },
]

// Header aliases for auto-detection (all lowercase)
const FIELD_ALIASES: Record<string, string> = {
  'company': 'companyName', 'company name': 'companyName', 'company_name': 'companyName',
  'organisation': 'companyName', 'organization': 'companyName', 'org': 'companyName',
  'contact': 'contactName', 'contact name': 'contactName', 'contact_name': 'contactName',
  'full name': 'contactName', 'name': 'contactName', 'person': 'contactName',
  'email': 'email', 'email address': 'email', 'e-mail': 'email',
  'phone': 'phone', 'telephone': 'phone', 'mobile': 'phone', 'cell': 'phone',
  'website': 'website', 'url': 'website', 'web': 'website', 'site': 'website',
  'industry': 'industry', 'sector': 'industry',
  'company size': 'companySize', 'company_size': 'companySize', 'size': 'companySize', 'employees': 'companySize',
  'lead source': 'leadSource', 'lead_source': 'leadSource', 'source': 'leadSource', 'how found': 'leadSource',
  'status': 'status', 'stage': 'status', 'pipeline stage': 'status',
  'estimated value': 'estimatedValue', 'estimated_value': 'estimatedValue',
  'value': 'estimatedValue', 'amount': 'estimatedValue', 'deal value': 'estimatedValue',
  'project type': 'projectType', 'project_type': 'projectType', 'project': 'projectType', 'type': 'projectType',
  'last contact': 'lastContactDate', 'last contact date': 'lastContactDate', 'last_contact': 'lastContactDate',
  'last contacted': 'lastContactDate',
  'next followup': 'nextFollowupDate', 'next follow-up': 'nextFollowupDate', 'next follow up': 'nextFollowupDate',
  'next_followup': 'nextFollowupDate', 'followup date': 'nextFollowupDate', 'follow up': 'nextFollowupDate',
  'next action': 'nextFollowupDate',
}

const TEMPLATE_HEADERS = CLIENT_FIELDS.map((f) => f.label)
const TEMPLATE_EXAMPLE = [
  'Acme Corp', 'Jane Smith', 'jane@acme.com', '+1 555 0100', 'https://acme.com',
  'Technology', '11–50', 'Referral', 'lead', '5000', 'Web redesign', '2024-01-15', '2024-02-15',
]

// ── Helpers ────────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  return lines
    .filter((l) => l.trim())
    .map((line) => {
      const fields: string[] = []
      let i = 0
      while (i < line.length) {
        if (line[i] === '"') {
          let field = ''
          i++
          while (i < line.length) {
            if (line[i] === '"' && line[i + 1] === '"') { field += '"'; i += 2 }
            else if (line[i] === '"') { i++; break }
            else field += line[i++]
          }
          fields.push(field)
          if (i < line.length && line[i] === ',') i++
        } else {
          const end = line.indexOf(',', i)
          if (end === -1) { fields.push(line.slice(i).trim()); break }
          fields.push(line.slice(i, end).trim())
          i = end + 1
        }
      }
      return fields
    })
}

function detectFieldMap(headers: string[]): Record<number, string> {
  const map: Record<number, string> = {}
  headers.forEach((h, i) => {
    const key = h.toLowerCase().trim()
    if (FIELD_ALIASES[key]) map[i] = FIELD_ALIASES[key]
  })
  return map
}

function applyMapping(
  dataRows: string[][],
  fieldMap: Record<number, string>,
): ImportRow[] {
  return dataRows.map((row) => {
    const mapped: ImportRow = {}
    Object.entries(fieldMap).forEach(([col, field]) => {
      if (!field) return
      const val = row[Number(col)] ?? ''
      if (val.trim()) mapped[field] = val.trim()
    })
    return mapped
  })
}

function downloadTemplate() {
  const lines = [
    TEMPLATE_HEADERS.join(','),
    TEMPLATE_EXAMPLE.map((v) => `"${v}"`).join(','),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'promptdesk-clients-template.csv'
  a.click()
  URL.revokeObjectURL(url)
}

// ── Types ──────────────────────────────────────────────────────────────────

type Step = 'idle' | 'mapping' | 'importing' | 'done'

// ── Main component ─────────────────────────────────────────────────────────

export function CsvImporter() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>('idle')
  const [parseError, setParseError] = useState<string | null>(null)

  // Parsed CSV state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([])
  const [csvDataRows, setCsvDataRows] = useState<string[][]>([])
  const [fieldMap, setFieldMap] = useState<Record<number, string>>({})

  // Results
  const [result, setResult] = useState<ImportResult | null>(null)
  const [showErrors, setShowErrors] = useState(false)

  const [isPending, startTransition] = useTransition()

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setParseError('Please upload a CSV file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setParseError('File too large — max 5 MB.')
      return
    }

    setParseError(null)
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const rows = parseCSV(text)
        if (rows.length < 2) {
          setParseError('CSV must have a header row and at least one data row.')
          return
        }
        const [headers, ...data] = rows
        setCsvHeaders(headers)
        setCsvDataRows(data)
        setFieldMap(detectFieldMap(headers))
        setStep('mapping')
      } catch {
        setParseError('Could not parse the CSV file. Check that it is valid.')
      }
    }
    reader.readAsText(file)
  }

  function handleImport() {
    const mappedRows = applyMapping(csvDataRows, fieldMap)
    startTransition(async () => {
      const res = await importClientsAction(mappedRows)
      setResult(res)
      setShowErrors(false)
      setStep('done')
    })
  }

  function reset() {
    setStep('idle')
    setCsvHeaders([])
    setCsvDataRows([])
    setFieldMap({})
    setResult(null)
    setParseError(null)
  }

  // Derived
  const identifyingFields = new Set(['companyName', 'contactName', 'email'])
  const hasIdentifyingColumn = Object.values(fieldMap).some((f) => identifyingFields.has(f))
  const mappedCount = csvDataRows.filter((row) =>
    Object.entries(fieldMap).some(([col, field]) => field && row[Number(col)]?.trim()),
  ).length
  // Warn when the same target field is mapped from two columns
  const mappedFields = Object.values(fieldMap).filter(Boolean)
  const duplicateFields = mappedFields.filter((f, i) => mappedFields.indexOf(f) !== i)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium">Import clients</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Upload a CSV to bulk-create clients. Download the template to see the expected format.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download />
          Template
        </Button>
      </div>

      {/* ── Step 1: idle ─────────────────────────────────────────────── */}
      {step === 'idle' && (
        <div className="flex flex-col gap-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="sr-only"
            aria-hidden
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-muted/30"
          >
            <Upload className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">Click to upload a CSV file</p>
            <p className="text-xs text-muted-foreground">Max 5 MB</p>
          </button>
          {parseError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {parseError}
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: mapping ──────────────────────────────────────────── */}
      {step === 'mapping' && (
        <div className="flex flex-col gap-5">
          {/* Column mapping */}
          <div className="rounded-xl border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-medium">Map columns</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {csvDataRows.length} data {csvDataRows.length === 1 ? 'row' : 'rows'} detected
              </p>
            </div>
            <div className="divide-y divide-border">
              {csvHeaders.map((header, colIdx) => (
                <div key={colIdx} className="flex items-center gap-4 px-4 py-2.5">
                  <span className="w-40 truncate text-sm font-medium" title={header}>
                    {header}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <select
                    value={fieldMap[colIdx] ?? ''}
                    onChange={(e) =>
                      setFieldMap((prev) => ({ ...prev, [colIdx]: e.target.value }))
                    }
                    className="flex-1 h-7 rounded-lg border border-input bg-transparent px-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <option value="">(ignore)</option>
                    {CLIENT_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Duplicate field warning */}
          {duplicateFields.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              Multiple columns map to the same field (
              {[...new Set(duplicateFields)]
                .map((f) => CLIENT_FIELDS.find((cf) => cf.value === f)?.label ?? f)
                .join(', ')}
              ). Only the last column's value will be used.
            </div>
          )}

          {/* Preview table */}
          {csvDataRows.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Preview (first {Math.min(3, csvDataRows.length)} rows)
              </p>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {Object.entries(fieldMap)
                        .filter(([, f]) => f)
                        .map(([col, field]) => (
                          <th key={col} className="px-3 py-2 text-left font-medium text-muted-foreground">
                            {CLIENT_FIELDS.find((cf) => cf.value === field)?.label ?? field}
                          </th>
                        ))}
                    </tr>
                  </thead>
                  <tbody>
                    {csvDataRows.slice(0, 3).map((row, ri) => (
                      <tr key={ri} className="border-b border-border last:border-0">
                        {Object.entries(fieldMap)
                          .filter(([, f]) => f)
                          .map(([col]) => (
                            <td key={col} className="px-3 py-2 max-w-[160px] truncate">
                              {row[Number(col)] ?? ''}
                            </td>
                          ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {!hasIdentifyingColumn && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              Map at least one of Company name, Contact name, or Email to proceed.
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={reset}>
              ← Back
            </Button>
            <Button
              onClick={handleImport}
              disabled={!hasIdentifyingColumn || isPending || mappedCount === 0}
            >
              Import {mappedCount > 0 ? `${mappedCount} ` : ''}
              {mappedCount === 1 ? 'client' : 'clients'}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 3: importing ──────────────────────────────────────────── */}
      {step === 'importing' && (
        <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
          <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
          Importing…
        </div>
      )}

      {/* ── Step 4: done ─────────────────────────────────────────────── */}
      {step === 'done' && result && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5">
          {result.imported > 0 && (
            <div className="flex items-center gap-2 text-sm font-medium text-green-600 dark:text-green-400">
              <CheckCircle2 className="size-4" />
              {result.imported} {result.imported === 1 ? 'client' : 'clients'} imported
            </div>
          )}
          {result.skipped > 0 && (
            <div className="flex items-center gap-2 text-sm text-amber-600 dark:text-amber-400">
              <AlertCircle className="size-4" />
              {result.skipped} {result.skipped === 1 ? 'row' : 'rows'} skipped
            </div>
          )}
          {result.imported === 0 && result.skipped === 0 && (
            <p className="text-sm text-muted-foreground">No rows to import.</p>
          )}

          {result.errors.length > 0 && (
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowErrors((v) => !v)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showErrors ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
                {showErrors ? 'Hide' : 'Show'} {result.errors.length} error
                {result.errors.length !== 1 ? 's' : ''}
              </button>
              {showErrors && (
                <ul className="rounded-lg border border-border bg-muted/20 divide-y divide-border text-xs">
                  {result.errors.map((e, i) => (
                    <li key={i} className="flex items-start gap-3 px-3 py-2">
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        Row {e.row}
                      </span>
                      <span className="text-destructive">{e.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <Button variant="outline" size="sm" onClick={reset} className="self-start mt-1">
            Import another file
          </Button>
        </div>
      )}
    </div>
  )
}
