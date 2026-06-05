'use client'

import * as React from 'react'
import { Dialog } from '@base-ui/react/dialog'
import { XIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

function fmt(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export interface BreakdownItem {
  date?: string
  label: string
  sublabel?: string
  amount: number
  prefix?: string     // e.g. '-' to prefix the amount display
  dim?: boolean       // lighter style for estimates / synthetic rows
  separator?: string  // section label rendered above this row
}

interface BreakdownDialogProps {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  items: BreakdownItem[]
  total: number
  totalLabel?: string
  emptyMessage?: string
}

export function BreakdownDialog({
  open,
  onClose,
  title,
  subtitle,
  items,
  total,
  totalLabel = 'Total',
  emptyMessage = 'No data for this period.',
}: BreakdownDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 flex w-full max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl border border-border bg-background shadow-xl transition-all duration-200 data-ending-style:translate-y-1 data-ending-style:opacity-0 data-starting-style:translate-y-1 data-starting-style:opacity-0 max-h-[80vh]">

          {/* Header */}
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-5">
            <div>
              <Dialog.Title className="text-base font-semibold text-foreground">
                {title}
              </Dialog.Title>
              {subtitle && (
                <Dialog.Description className="mt-0.5 text-sm text-muted-foreground">
                  {subtitle}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close render={<Button variant="ghost" size="icon-sm" className="shrink-0" />}>
              <XIcon className="size-4" />
              <span className="sr-only">Close</span>
            </Dialog.Close>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5">
            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {items.map((item, i) => (
                    <React.Fragment key={i}>
                      {item.separator !== undefined && (
                        <tr>
                          <td colSpan={2} className="pb-1 pt-4 first:pt-0">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {item.separator}
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr className={cn(item.dim && 'opacity-60')}>
                        <td className="py-1.5 pr-4">
                          <div className="flex items-baseline gap-2">
                            {item.date && (
                              <span className="shrink-0 text-xs text-muted-foreground">
                                {item.date}
                              </span>
                            )}
                            <span className="font-medium">{item.label}</span>
                          </div>
                          {item.sublabel && (
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {item.sublabel}
                            </div>
                          )}
                        </td>
                        <td className="py-1.5 text-right tabular-nums whitespace-nowrap font-medium">
                          {item.prefix ?? ''}{fmt(item.amount)}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer / Total */}
          <div className="flex shrink-0 items-center justify-between border-t border-border px-5 py-4">
            <span className="text-sm font-medium text-muted-foreground">{totalLabel}</span>
            <span className="text-base font-semibold tabular-nums">{fmt(total)}</span>
          </div>

        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
