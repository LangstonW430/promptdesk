'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTour } from './tour-context'

const STEPS = [
  {
    title: 'Your dashboard',
    text: 'This is your business command center. It shows your pipeline value, leads, revenue forecast, and the most important actions to take today — all at a glance.',
    primaryLabel: 'Next →',
    primaryAction: 'next' as const,
    hint: null,
  },
  {
    title: 'Managing clients',
    text: 'Add clients and move them through your pipeline: Lead → Contacted → Proposal Sent → Negotiating → Won. Set an Estimated Value on each client — this determines who surfaces as a "hot lead" in your daily actions.',
    primaryLabel: 'Open Clients →',
    primaryAction: 'navigate-clients' as const,
    hint: 'Tip: Use the Kanban view to drag cards between stages.',
  },
  {
    title: 'Projects',
    text: 'Once a client is won, create a project to track deliverables, progress, and time. Open a project and start the timer — hours are logged directly to that project, not just the client. The Time tab shows everything billed to that project.',
    primaryLabel: 'Open Projects →',
    primaryAction: 'navigate-projects' as const,
    hint: 'Tip: Create a project from the Projects page or directly from a client page.',
  },
  {
    title: 'Daily Action Center',
    text: 'Check here every morning. It shows overdue follow-ups, high-value leads to prioritise, and clients you haven\'t contacted in 30+ days. Each row has a "Generate prompt" shortcut for AI-written outreach.',
    primaryLabel: 'Open Daily Actions →',
    primaryAction: 'navigate-daily-actions' as const,
    hint: null,
  },
  {
    title: 'Creating invoices',
    text: 'Create invoices from scratch or convert logged time entries directly into a bill. Add your line items, set a due date, and save.',
    primaryLabel: 'Open Invoices →',
    primaryAction: 'navigate-invoices' as const,
    hint: null,
  },
  {
    title: 'Sending & getting paid',
    text: 'After creating an invoice, open it and click "Mark as Sent" in the sidebar. This activates a shareable client link — your client clicks it, sees the invoice, and can pay online with a card (if you\'ve connected Stripe in Settings).',
    primaryLabel: 'Next →',
    primaryAction: 'next' as const,
    hint: 'Tip: Connect Stripe in Settings → Stripe to enable one-click card payments.',
  },
  {
    title: 'AI prompt generation',
    text: 'The Prompts page turns your CRM data into ready-to-paste AI text. Use "Business Action Plan" for a full strategy, or "Client Insight" on any client for a health check. Copy and paste into ChatGPT, Claude, or any AI tool.',
    primaryLabel: 'Open Prompts →',
    primaryAction: 'navigate-prompts' as const,
    hint: null,
  },
]

type Action =
  | 'next'
  | 'navigate-clients'
  | 'navigate-projects'
  | 'navigate-daily-actions'
  | 'navigate-invoices'
  | 'navigate-prompts'

export function TourBanner() {
  const { step, totalSteps, active, next, skip } = useTour()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-advance when the user navigates to the target page
  useEffect(() => {
    if (!active) return
    if (step === 2 && pathname === '/clients') next()
    if (step === 3 && pathname === '/projects') next()
    if (step === 4 && pathname === '/daily-actions') next()
    if (step === 5 && pathname === '/invoices') next()
    if (step === 7 && pathname === '/prompts') skip()
  }, [pathname, active, step, next, skip])

  if (!mounted || !active) return null

  const currentStep = STEPS[step - 1]
  if (!currentStep) return null

  function handlePrimary(action: Action) {
    switch (action) {
      case 'next':
        next()
        break
      case 'navigate-clients':
        router.push('/clients')
        break
      case 'navigate-projects':
        router.push('/projects')
        break
      case 'navigate-daily-actions':
        router.push('/daily-actions')
        break
      case 'navigate-invoices':
        router.push('/invoices')
        break
      case 'navigate-prompts':
        router.push('/prompts')
        break
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-50 w-[calc(100vw-3rem)] max-w-sm -translate-x-1/2 rounded-xl border border-border bg-card shadow-lg"
    >
      {/* Header row */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-primary">{currentStep.title}</span>
          <span className="text-xs text-muted-foreground">
            {step} / {totalSteps}
          </span>
        </div>
        <button
          onClick={skip}
          className="rounded text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Close tour"
        >
          <X className="size-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mx-4 mb-2 h-1 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${(step / totalSteps) * 100}%` }}
        />
      </div>

      <p className="px-4 pb-2 text-sm text-muted-foreground leading-relaxed">
        {currentStep.text}
      </p>

      {currentStep.hint && (
        <p className="px-4 pb-3 text-xs text-primary/70 leading-relaxed">
          {currentStep.hint}
        </p>
      )}

      <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
        <button
          onClick={skip}
          className="rounded text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Skip tour
        </button>
        <Button size="default" onClick={() => handlePrimary(currentStep.primaryAction as Action)}>
          {currentStep.primaryLabel}
        </Button>
      </div>
    </div>
  )
}
