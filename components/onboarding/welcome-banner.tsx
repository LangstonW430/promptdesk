'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { Sparkles, Loader2, AlertCircle, X } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { loadSampleDataAction, clearSampleDataAction } from '@/lib/actions/sample-data'
import { dismissOnboardingAction } from '@/lib/actions/users'
import { useTour } from './tour-context'
import { useState } from 'react'
import { cn } from '@/lib/utils'

interface WelcomeBannerProps {
  hasSampleData: boolean
  onboardingDismissed: boolean
  totalClients: number
}

export function WelcomeBanner({ hasSampleData, onboardingDismissed, totalClients }: WelcomeBannerProps) {
  const { start } = useTour()
  const [loadPending, startLoad] = useTransition()
  const [clearPending, startClear] = useTransition()
  const [dismissPending, startDismiss] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // State C — no banner needed
  if (!hasSampleData && (onboardingDismissed || totalClients > 0)) {
    return null
  }

  // State B — sample data is loaded
  if (hasSampleData) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm dark:border-amber-800/40 dark:bg-amber-950/20">
        <span className="text-amber-800 dark:text-amber-300">
          You&apos;re exploring with sample data
        </span>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-xs text-destructive">{error}</span>
          )}
          <Button
            size="xs"
            variant="outline"
            disabled={clearPending}
            onClick={() => {
              setError(null)
              startClear(async () => {
                const res = await clearSampleDataAction()
                if (!res.success) setError(res.error ?? 'Error')
              })
            }}
          >
            {clearPending && <Loader2 className="size-3 animate-spin" />}
            Clear sample data
          </Button>
          <Button
            size="xs"
            variant="ghost"
            onClick={start}
          >
            Start tour
          </Button>
        </div>
      </div>
    )
  }

  // State A — fresh user
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-4">
        <h2 className="text-lg font-semibold">Welcome to PromptDesk</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your freelance pipeline and generate AI prompts for outreach, check-ins, and planning.
          Get started in under two minutes.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          disabled={loadPending}
          onClick={() => {
            setError(null)
            startLoad(async () => {
              const res = await loadSampleDataAction()
              if (res.success) {
                start()
              } else {
                setError(res.error ?? 'Failed to load sample data')
              }
            })
          }}
        >
          {loadPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Load sample data
        </Button>
        <Link href="/settings" className={cn(buttonVariants({ variant: 'outline' }))}>
          Import from CSV
        </Link>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <Link
          href="/clients/new"
          className="text-sm text-primary hover:underline"
        >
          Add your first client →
        </Link>
        <button
          disabled={dismissPending}
          onClick={() => {
            startDismiss(async () => {
              await dismissOnboardingAction()
            })
          }}
          className="flex items-center gap-1 rounded text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          <X className="size-3" />
          Skip
        </button>
      </div>
    </div>
  )
}
