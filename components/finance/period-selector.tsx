'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useCallback } from 'react'
import { cn } from '@/lib/utils'
import type { Period } from '@/lib/finance/types'

const OPTIONS: { value: Period; label: string }[] = [
  { value: 'thisMonth',   label: 'This Month' },
  { value: 'thisQuarter', label: 'This Quarter' },
  { value: 'ytd',         label: 'Year to Date' },
  { value: 'allTime',     label: 'All Time' },
]

interface PeriodSelectorProps {
  value: Period
}

export function PeriodSelector({ value }: PeriodSelectorProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const select = useCallback(
    (period: Period) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set('period', period)
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams],
  )

  return (
    <div role="group" aria-label="Select period" className="flex rounded-lg border border-border bg-muted/40 p-0.5 gap-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => select(opt.value)}
          className={cn(
            'rounded-md px-3 py-1 text-xs font-medium transition-colors',
            value === opt.value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
          aria-pressed={value === opt.value}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
