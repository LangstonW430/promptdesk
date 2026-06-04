'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTour } from './tour-context'

const STEPS = [
  {
    label: 'Step 1 of 3',
    text: 'Your dashboard shows your full pipeline at a glance — leads, active clients, pipeline value, and forecasts.',
    primaryLabel: 'Next →',
    primaryAction: 'next' as const,
  },
  {
    label: 'Step 2 of 3',
    text: 'The Daily Action Center shows exactly who to contact today, ranked by urgency.',
    primaryLabel: 'Open Daily Actions →',
    primaryAction: 'navigate-daily-actions' as const,
  },
  {
    label: 'Step 3 of 3',
    text: 'The Prompts page generates ready-to-paste AI text. Try the Action Plan button for a full business strategy.',
    primaryLabel: 'Open Prompts →',
    primaryAction: 'navigate-prompts' as const,
  },
]

export function TourBanner() {
  const { step, active, next, skip } = useTour()
  const router = useRouter()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!active) return
    if (step === 2 && pathname === '/daily-actions') next()
    if (step === 3 && pathname === '/prompts') skip()
  }, [pathname, active, step, next, skip])

  if (!mounted || !active) return null

  const currentStep = STEPS[step - 1]

  function handlePrimary() {
    if (currentStep.primaryAction === 'next') {
      next()
    } else if (currentStep.primaryAction === 'navigate-daily-actions') {
      router.push('/daily-actions')
    } else if (currentStep.primaryAction === 'navigate-prompts') {
      router.push('/prompts')
    }
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-50 w-[calc(100vw-3rem)] max-w-sm -translate-x-1/2 rounded-xl border border-border bg-card shadow-lg"
    >
      <div className="flex items-start justify-between gap-3 px-4 pt-3 pb-1">
        <span className="text-xs font-medium text-primary">{currentStep.label}</span>
        <button
          onClick={skip}
          className="rounded text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          aria-label="Skip tour"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <p className="px-4 pb-3 text-sm text-muted-foreground leading-relaxed">
        {currentStep.text}
      </p>
      <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
        <button
          onClick={skip}
          className="rounded text-xs text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Skip tour
        </button>
        <Button size="default" onClick={handlePrimary}>
          {currentStep.primaryLabel}
        </Button>
      </div>
    </div>
  )
}
