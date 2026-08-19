'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DownloadCloud, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { importStripeInvoicesAction } from '@/lib/actions/invoices'

/**
 * Pulls invoices raised outside PromptDesk into the list.
 *
 * Safe to press repeatedly: the import keys on the Stripe invoice id, refreshes
 * what Stripe owns, and leaves the project, archive flag and any client link
 * you set by hand exactly as they were.
 */
export function ImportInvoicesButton() {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string | null>(null)

  function handleImport() {
    setError(null)
    setSummary(null)
    start(async () => {
      const result = await importStripeInvoicesAction()
      if (!result.success) {
        setError(result.error)
        return
      }
      const { imported, updated, unattributed } = result.data
      const parts: string[] = []
      if (imported) parts.push(`${imported} imported`)
      if (updated) parts.push(`${updated} refreshed`)
      if (!imported && !updated) parts.push('nothing new')
      // Worth stating plainly — these are the ones needing a manual link.
      if (unattributed) parts.push(`${unattributed} with no matching client`)
      setSummary(parts.join(', '))
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <Button
        variant="outline"
        className="gap-1.5"
        disabled={isPending}
        onClick={handleImport}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <DownloadCloud className="size-4" />
        )}
        {isPending ? 'Importing…' : 'Import from Stripe'}
      </Button>

      {error && (
        <p className="flex max-w-xs items-start gap-1.5 text-right text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}
      {summary && (
        <p className="flex max-w-xs items-start gap-1.5 text-right text-xs text-muted-foreground">
          <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
          {summary}
        </p>
      )}
    </div>
  )
}
