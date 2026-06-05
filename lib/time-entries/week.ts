// Pure date helpers — no browser APIs, safe to import on both server and client.

export function getMondayOf(d: Date): Date {
  const day  = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + diff)
}

export function currentMondayISO(): string {
  return getMondayOf(new Date()).toISOString().slice(0, 10)
}

export function getWeekBounds(weekStart: string): { from: string; to: string } {
  const monday = new Date(weekStart + 'T00:00:00')
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 7)
  return {
    from: monday.toISOString().slice(0, 10),
    to:   sunday.toISOString().slice(0, 10),
  }
}

export function shiftWeek(weekStart: string, delta: number): string {
  const d = new Date(weekStart + 'T00:00:00')
  d.setDate(d.getDate() + delta * 7)
  return d.toISOString().slice(0, 10)
}

export function formatWeekRange(weekStart: string): string {
  const from = new Date(weekStart + 'T00:00:00')
  const to   = new Date(weekStart + 'T00:00:00')
  to.setDate(from.getDate() + 6)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${from.toLocaleDateString('en-US', opts)} – ${to.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}
