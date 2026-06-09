'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Play, Square, Clock, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { createTimeEntryAction } from '@/lib/actions/time-entries'

// ── localStorage persistence ──────────────────────────────────────────────────

const TIMER_KEY = 'promptdesk:active-timer'

interface StoredTimer {
  clientId:  string
  projectId: string | null
  startedAt: string  // ISO 8601
}

function readTimer(): StoredTimer | null {
  try {
    const raw = localStorage.getItem(TIMER_KEY)
    return raw ? (JSON.parse(raw) as StoredTimer) : null
  } catch {
    return null
  }
}

function writeTimer(t: StoredTimer) {
  localStorage.setItem(TIMER_KEY, JSON.stringify(t))
}

function clearTimer() {
  localStorage.removeItem(TIMER_KEY)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface Project { id: string; title: string; status: string }

interface SaveForm {
  hours:       string
  date:        string
  rate:        string
  description: string
  isBillable:  boolean
  projectId:   string
}

interface TimerWidgetProps {
  clientId:         string
  clientName:       string
  defaultRate:      number | null
  projects:         Project[]
  defaultProjectId?: string  // when set, pre-selects and locks the project dropdown
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TimerWidget({ clientId, clientName, defaultRate, projects, defaultProjectId }: TimerWidgetProps) {
  const router = useRouter()
  const [hydrated,  setHydrated]  = useState(false)
  const [running,   setRunning]   = useState(false)   // timer active for this client
  const [elapsed,   setElapsed]   = useState(0)       // seconds
  const [saveForm,  setSaveForm]  = useState<SaveForm | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Hydrate from localStorage — runs only on client
  useEffect(() => {
    const stored = readTimer()
    if (stored && stored.clientId === clientId) {
      const secs = Math.floor((Date.now() - new Date(stored.startedAt).getTime()) / 1000)
      setElapsed(Math.max(0, secs))
      setRunning(true)
    }
    setHydrated(true)
  }, [clientId])

  // Tick while running
  useEffect(() => {
    if (!running) {
      if (intervalRef.current) clearInterval(intervalRef.current)
      return
    }
    intervalRef.current = setInterval(() => {
      const stored = readTimer()
      if (!stored || stored.clientId !== clientId) { setRunning(false); return }
      setElapsed(Math.floor((Date.now() - new Date(stored.startedAt).getTime()) / 1000))
    }, 1000)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [running, clientId])

  function handleStart() {
    const t: StoredTimer = { clientId, projectId: defaultProjectId ?? null, startedAt: new Date().toISOString() }
    writeTimer(t)
    setElapsed(0)
    setRunning(true)
    setSaveForm(null)
  }

  function handleStop() {
    const stored = readTimer()
    clearTimer()
    setRunning(false)
    if (intervalRef.current) clearInterval(intervalRef.current)

    const hours = elapsed > 0 ? (elapsed / 3600).toFixed(2) : '0.25'
    setSaveForm({
      hours,
      date:        todayISO(),
      rate:        defaultRate != null ? String(defaultRate) : '',
      description: '',
      isBillable:  true,
      projectId:   stored?.projectId ?? defaultProjectId ?? '',
    })
    setSaveError(null)
  }

  function handleDiscard() {
    setSaveForm(null)
    setSaveError(null)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!saveForm) return
    setSaveError(null)

    const hoursNum = Number(saveForm.hours)
    if (Number.isNaN(hoursNum) || hoursNum <= 0) {
      setSaveError('Hours must be a positive number')
      return
    }

    startTransition(async () => {
      const result = await createTimeEntryAction({
        clientId,
        projectId:   saveForm.projectId || undefined,
        date:        saveForm.date,
        hours:       hoursNum,
        rate:        saveForm.rate !== '' ? Number(saveForm.rate) : undefined,
        description: saveForm.description || undefined,
        isBillable:  saveForm.isBillable,
      })
      if ('error' in result) {
        setSaveError(result.error ?? 'Failed to save')
        return
      }
      setSaveForm(null)
      router.refresh()
    })
  }

  // Don't render timer state before hydration (avoids SSR mismatch)
  if (!hydrated) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-4 py-3">
        <Clock className="size-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Time tracker</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Timer bar */}
      <div className={cn(
        'flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors',
        running
          ? 'border-primary/30 bg-primary/5'
          : 'border-border bg-muted/30',
      )}>
        <Clock className={cn('size-4 shrink-0', running ? 'text-primary' : 'text-muted-foreground')} />

        {running ? (
          <>
            <span className="flex-1 font-mono text-sm tabular-nums font-medium">
              {formatElapsed(elapsed)}
            </span>
            <span className="mr-auto text-xs text-muted-foreground truncate">
              {clientName}
            </span>
            <Button size="sm" variant="outline" onClick={handleStop} className="shrink-0">
              <Square className="size-3 fill-current" />
              Stop
            </Button>
          </>
        ) : saveForm ? (
          <span className="flex-1 text-sm text-muted-foreground">Timer stopped — save entry below</span>
        ) : (
          <>
            <span className="flex-1 text-sm text-muted-foreground">Track time for {clientName}</span>
            <Button size="sm" variant="outline" onClick={handleStart} className="shrink-0">
              <Play className="size-3 fill-current" />
              Start
            </Button>
          </>
        )}
      </div>

      {/* Save form — shown after stopping */}
      {saveForm && (
        <form
          onSubmit={handleSave}
          className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4"
        >
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Save time entry
          </p>

          {saveError && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertCircle className="size-3.5 shrink-0" />
              {saveError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {/* Hours */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">Hours</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="24"
                value={saveForm.hours}
                onChange={(e) => setSaveForm((f) => f && { ...f, hours: e.target.value })}
                disabled={isPending}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm tabular-nums focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
              />
            </div>

            {/* Date */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">Date</label>
              <input
                type="date"
                value={saveForm.date}
                onChange={(e) => setSaveForm((f) => f && { ...f, date: e.target.value })}
                disabled={isPending}
                className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
              />
            </div>

            {/* Rate */}
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-medium text-muted-foreground">Rate ($/hr)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="—"
                value={saveForm.rate}
                onChange={(e) => setSaveForm((f) => f && { ...f, rate: e.target.value })}
                disabled={isPending}
                className="h-8 rounded-lg border border-input bg-background px-2 text-sm tabular-nums placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
              />
            </div>

            {/* Project */}
            {projects.length > 0 && (
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-medium text-muted-foreground">Project</label>
                <select
                  value={saveForm.projectId}
                  onChange={(e) => setSaveForm((f) => f && { ...f, projectId: e.target.value })}
                  disabled={isPending || !!defaultProjectId}
                  className="h-8 rounded-lg border border-input bg-background px-2 text-sm text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
                >
                  <option value="">No project</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.title}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-medium text-muted-foreground">Description</label>
            <input
              type="text"
              placeholder="What did you work on?"
              value={saveForm.description}
              onChange={(e) => setSaveForm((f) => f && { ...f, description: e.target.value })}
              disabled={isPending}
              className="h-8 rounded-lg border border-input bg-background px-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
            />
          </div>

          {/* Billable toggle + actions */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={saveForm.isBillable}
                onChange={(e) => setSaveForm((f) => f && { ...f, isBillable: e.target.checked })}
                disabled={isPending}
                className="rounded border-input accent-primary"
              />
              <span className="text-sm">Billable</span>
            </label>

            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDiscard}
                disabled={isPending}
              >
                Discard
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending || !saveForm.date || !saveForm.hours}
              >
                {isPending && <Loader2 className="size-3 animate-spin" />}
                Save entry
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  )
}
