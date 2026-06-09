'use client'

import { useTransition, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Loader2, AlertCircle, X, Users, CalendarCheck, FileText, Zap, CreditCard } from 'lucide-react'
import { Button, buttonVariants } from '@/components/ui/button'
import { loadSampleDataAction, clearSampleDataAction } from '@/lib/actions/sample-data'
import { dismissOnboardingAction } from '@/lib/actions/users'
import { useTour } from './tour-context'
import { cn } from '@/lib/utils'

interface WelcomeBannerProps {
  hasSampleData: boolean
  onboardingDismissed: boolean
  totalClients: number
}

const WORKFLOW_STEPS = [
  {
    icon: Users,
    label: 'Add clients',
    detail: 'Build your pipeline from Lead to Won. Set estimated values to surface hot leads.',
  },
  {
    icon: CalendarCheck,
    label: 'Daily actions',
    detail: 'Every morning, see exactly who to follow up with — ranked by urgency and deal value.',
  },
  {
    icon: FileText,
    label: 'Create & send invoices',
    detail: 'Bill clients from line items or logged time. Mark as Sent to share a payment link.',
  },
  {
    icon: CreditCard,
    label: 'Get paid online',
    detail: 'Connect Stripe in Settings so clients can pay invoices by card in one click.',
  },
  {
    icon: Zap,
    label: 'Generate AI prompts',
    detail: 'Turn your CRM data into ready-to-paste prompts for outreach, planning, and client reviews.',
  },
]

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
          You&apos;re exploring with sample data — take the tour to see how everything works.
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
          <Button size="xs" variant="ghost" onClick={start}>
            Start tour
          </Button>
        </div>
      </div>
    )
  }

  // State A — fresh user
  return (
    <div className="rounded-xl border border-border bg-card p-6">
      <div className="mb-5">
        <h2 className="text-lg font-semibold">Welcome to PromptDesk</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Your AI-assisted business command center for freelancers. Here&apos;s how it works:
        </p>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {WORKFLOW_STEPS.map((s, i) => {
          const Icon = s.icon
          return (
            <div key={i} className="flex flex-col gap-1.5 rounded-lg bg-muted/40 px-3 py-3">
              <div className="flex items-center gap-2">
                <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                  {i + 1}
                </span>
                <Icon className="size-3.5 text-muted-foreground" />
                <span className="text-xs font-medium">{s.label}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{s.detail}</p>
            </div>
          )
        })}
      </div>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
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
          Load sample data &amp; take the tour
        </Button>
        <Link href="/clients/new" className={cn(buttonVariants({ variant: 'outline' }))}>
          Add your first client
        </Link>
        <Link href="/settings" className={cn(buttonVariants({ variant: 'ghost' }), 'text-muted-foreground')}>
          Import from CSV
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
          Dismiss
        </button>
      </div>
    </div>
  )
}
