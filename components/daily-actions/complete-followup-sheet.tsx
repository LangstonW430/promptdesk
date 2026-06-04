'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, CalendarDays } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { completeFollowUpAction } from '@/lib/actions/daily-actions'

interface CompleteFollowUpSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  clientId: string
  clientName: string
}

export function CompleteFollowUpSheet({
  open,
  onOpenChange,
  clientId,
  clientName,
}: CompleteFollowUpSheetProps) {
  const [nextDate, setNextDate] = useState('')
  const [noteText, setNoteText] = useState('')
  const [serverError, setServerError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const todayStr = new Date().toISOString().split('T')[0]

  function reset() {
    setNextDate('')
    setNoteText('')
    setServerError(null)
  }

  function handleOpenChange(next: boolean) {
    if (!next) reset()
    onOpenChange(next)
  }

  function handleSave() {
    setServerError(null)
    startTransition(async () => {
      const result = await completeFollowUpAction(clientId, {
        nextFollowupDate: nextDate || null,
        noteText: noteText || undefined,
      })
      if ('error' in result) {
        setServerError(result.error ?? 'Something went wrong')
        return
      }
      handleOpenChange(false)
    })
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle>Complete Follow-up</SheetTitle>
          <SheetDescription className="truncate">{clientName}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto p-4">
          {/* Completion indicator */}
          <div className="flex items-center gap-2.5 rounded-lg bg-green-50 px-3 py-2.5 dark:bg-green-950/30">
            <CheckCircle2 className="size-4 shrink-0 text-green-600 dark:text-green-500" />
            <span className="text-sm font-medium text-green-700 dark:text-green-400">
              Follow-up marked as done
            </span>
          </div>

          {/* Next follow-up date */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="next-date"
              className="flex items-center gap-1.5 text-sm font-medium"
            >
              <CalendarDays className="size-3.5 text-muted-foreground" />
              Schedule next follow-up
            </label>
            <input
              id="next-date"
              type="date"
              aria-describedby="next-date-hint"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              value={nextDate}
              min={todayStr}
              onChange={(e) => setNextDate(e.target.value)}
            />
            <p id="next-date-hint" className="text-xs text-muted-foreground">
              Leave blank to just mark as done without scheduling.
            </p>
          </div>

          {/* Optional note */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="note-text" className="text-sm font-medium">
              Add a note{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <Textarea
              id="note-text"
              aria-describedby="note-text-hint"
              placeholder="Quick call — discussed timeline, sending proposal by Friday…"
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={4}
              className="resize-none text-sm"
            />
            <p id="note-text-hint" className="text-xs text-muted-foreground">
              Saved as a call note on the client record.
            </p>
          </div>

          {serverError && (
            <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}
        </div>

        <SheetFooter className="border-t border-border p-4">
          <Button
            onClick={handleSave}
            disabled={isPending}
            className="w-full"
          >
            {isPending ? 'Saving…' : nextDate ? 'Mark Done & Schedule Next' : 'Mark Done'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
