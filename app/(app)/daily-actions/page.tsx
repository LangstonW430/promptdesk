import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Clock, Flame, Snowflake, CheckSquare, Bell } from 'lucide-react'
import { getOwnerId } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { buttonVariants } from '@/components/ui/button'
import {
  getOverdueFollowUps,
  getHotLeads,
  getGoingCold,
  getRetainerReminders,
  type ActionClient,
  type RetainerReminder,
} from '@/lib/daily-actions'
import { Card, CardContent } from '@/components/ui/card'
import { ActionRow } from '@/components/daily-actions/action-row'
import { formatCurrency } from '@/lib/dashboard/format'
import { cn } from '@/lib/utils'

// ─── Queue section wrapper (server component, inline) ─────────────────────────

function QueueSection({
  title,
  description,
  icon: Icon,
  iconClass,
  badgeClass,
  clients,
  queueType,
  defaultAi,
  emptyMessage,
}: {
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  iconClass: string
  badgeClass: string
  clients: ActionClient[]
  queueType: 'overdue' | 'hot' | 'cold'
  defaultAi: string | null
  emptyMessage: string
}) {
  return (
    <section className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Icon className={cn('size-4 shrink-0', iconClass)} />
        <h2 className="text-base font-semibold">{title}</h2>
        {clients.length > 0 && (
          <span
            className={cn(
              'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
              badgeClass,
            )}
          >
            {clients.length}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>

      {/* Rows */}
      <Card>
        <CardContent className="p-0">
          {clients.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-muted-foreground">
              {emptyMessage}
            </p>
          ) : (
            <div>
              {clients.map((c, i) => (
                <ActionRow
                  key={c.id}
                  client={c}
                  queueType={queueType}
                  defaultAi={defaultAi}
                  isLast={i === clients.length - 1}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

// ─── Retainer reminder section (server component, inline) ────────────────────

function RetainerSection({ reminders }: { reminders: RetainerReminder[] }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Bell className="size-4 shrink-0 text-violet-500" />
        <h2 className="text-base font-semibold">Retainer reminders</h2>
        {reminders.length > 0 && (
          <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
            {reminders.length}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Recurring retainers with an invoice due in the next 7 days.
      </p>
      <Card>
        <CardContent className="p-0">
          {reminders.length === 0 ? (
            <p className="px-4 py-5 text-center text-sm text-muted-foreground">
              No retainer invoices due in the next 7 days.
            </p>
          ) : (
            <div>
              {reminders.map((r, i) => {
                const when =
                  r.daysUntilDue === 0
                    ? 'Today'
                    : r.daysUntilDue === 1
                    ? 'Tomorrow'
                    : `In ${r.daysUntilDue} days`
                const FREQ_LABEL: Record<string, string> = {
                  monthly: 'monthly',
                  quarterly: 'quarterly',
                  annual: 'annual',
                }
                return (
                  <div
                    key={r.transactionId}
                    className={cn(
                      'flex items-center justify-between px-4 py-3 text-sm',
                      i < reminders.length - 1 && 'border-b border-border',
                    )}
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{r.clientName}</span>
                      <span className="text-xs text-muted-foreground capitalize">
                        {FREQ_LABEL[r.frequency]} retainer · {formatCurrency(r.amount)}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        r.daysUntilDue === 0
                          ? 'text-destructive'
                          : r.daysUntilDue <= 2
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-muted-foreground',
                      )}
                    >
                      {when}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DailyActionsPage() {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const [overdueFollowUps, hotLeads, goingCold, retainerReminders, user, totalClients] = await Promise.all([
    getOverdueFollowUps(ownerId),
    getHotLeads(ownerId),
    getGoingCold(ownerId),
    getRetainerReminders(ownerId),
    prisma.user.findUnique({
      where: { id: ownerId },
      select: { defaultAi: true },
    }),
    prisma.client.count({ where: { ownerId, isArchived: false } }),
  ])

  const defaultAi = user?.defaultAi ?? null
  const total = overdueFollowUps.length + hotLeads.length + goingCold.length + retainerReminders.length

  return (
    <div className="flex flex-col gap-8">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Daily Actions</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {total > 0
            ? `${total} client${total === 1 ? '' : 's'} need${total === 1 ? 's' : ''} attention today`
            : "Nothing urgent — you're on top of it!"}
        </p>
      </div>

      {/* ── Full-page empty state when no clients exist ─────────── */}
      {totalClients === 0 && (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <CheckSquare className="size-6 text-muted-foreground" />
          </div>
          <div>
            <p className="text-lg font-medium">No clients in your pipeline yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add clients to start seeing your daily follow-up actions here.
            </p>
          </div>
          <Link href="/clients/new" className={buttonVariants()}>
            Add your first client
          </Link>
        </div>
      )}

      {/* ── Overdue follow-ups ──────────────────────────────────── */}
      <QueueSection
        title="Overdue follow-ups"
        description="Clients whose scheduled follow-up date has passed."
        icon={Clock}
        iconClass="text-red-500"
        badgeClass="bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
        clients={overdueFollowUps}
        queueType="overdue"
        defaultAi={defaultAi}
        emptyMessage="No overdue follow-ups — great work staying on top of your pipeline!"
      />

      {/* ── Hot leads ───────────────────────────────────────────── */}
      <QueueSection
        title="Hot leads"
        description="High-value leads and prospects worth prioritising."
        icon={Flame}
        iconClass="text-amber-500"
        badgeClass="bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
        clients={hotLeads}
        queueType="hot"
        defaultAi={defaultAi}
        emptyMessage="No high-value leads right now. Set estimated values on your leads to surface them here."
      />

      {/* ── Going cold ──────────────────────────────────────────── */}
      <QueueSection
        title="Going cold"
        description="Active clients with no contact in the last 30+ days."
        icon={Snowflake}
        iconClass="text-sky-500"
        badgeClass="bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400"
        clients={goingCold}
        queueType="cold"
        defaultAi={defaultAi}
        emptyMessage="All your active clients have been contacted in the last 30 days."
      />

      {/* ── Retainer reminders ──────────────────────────────────── */}
      <RetainerSection reminders={retainerReminders} />
    </div>
  )
}
