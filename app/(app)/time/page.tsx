import { redirect } from 'next/navigation'
import { Clock } from 'lucide-react'
import { getOwnerId } from '@/lib/auth'
import { listTimeEntries } from '@/lib/time-entries'
import { currentMondayISO, getWeekBounds } from '@/lib/time-entries/week'
import { WeeklyTimesheet } from '@/components/time-tracking/timesheet'

export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<{ weekStart?: string }>
}) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const { weekStart: rawWeekStart } = await searchParams
  // Validate format YYYY-MM-DD; fall back to current Monday
  const weekStart =
    rawWeekStart && /^\d{4}-\d{2}-\d{2}$/.test(rawWeekStart)
      ? rawWeekStart
      : currentMondayISO()

  const { from, to } = getWeekBounds(weekStart)
  const entries = await listTimeEntries(ownerId, { from, to })

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Time</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Log and invoice your hours
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <Clock className="size-3.5" />
          Start a timer from any project page
        </div>
      </div>

      <WeeklyTimesheet entries={entries} weekStart={weekStart} />
    </div>
  )
}
