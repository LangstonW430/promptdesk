'use client'

import { useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, Repeat2, Minus } from 'lucide-react'
import { StatCard } from '@/components/dashboard/stat-card'
import { SyncStripeButton } from './sync-stripe-button'
import { BreakdownDialog } from './breakdown-dialog'
import type { BreakdownItem } from './breakdown-dialog'
import { formatCurrency } from '@/lib/dashboard/format'
import { getPeriodBoundaries } from '@/lib/finance/calc'
import type { FinancialSummary, Period } from '@/lib/finance/types'
import type { ActiveMRRResult, SerializedSyncState } from '@/lib/finance/stripe-sync'
import type { SerializedTransaction } from '@/lib/finance/serialize'

type DialogId = 'income' | 'expenses' | 'grossMrr' | 'monthlyExpenses' | 'netMrr'

function periodLabel(period: Period): string {
  switch (period) {
    case 'thisMonth':   return 'This month'
    case 'thisQuarter': return 'This quarter'
    case 'ytd':         return 'Year to date'
    case 'allTime':     return 'All time'
  }
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function inRange(iso: string, from: Date | null, to: Date | null): boolean {
  const d = new Date(iso)
  if (from && d < from) return false
  if (to && d >= to) return false
  return true
}

interface Props {
  summary: FinancialSummary
  activeMRR: ActiveMRRResult
  transactions: SerializedTransaction[]
  period: Period
  syncState: SerializedSyncState | null
}

export function FinanceStatCards({ summary, activeMRR, transactions, period, syncState }: Props) {
  const [openDialog, setOpenDialog] = useState<DialogId | null>(null)
  const close = () => setOpenDialog(null)

  const { from, to } = getPeriodBoundaries(period)
  const { from: mFrom, to: mTo } = getPeriodBoundaries('thisMonth')
  const netIsPositive = summary.net >= 0

  // ── Breakdown item lists ──────────────────────────────────────────────────

  const incomeItems: BreakdownItem[] = transactions
    .filter((t) => t.type === 'income' && inRange(t.occurredAt, from, to))
    .map((t) => ({
      date: fmtDate(t.occurredAt),
      label: t.description || t.category,
      sublabel: t.clientName ?? undefined,
      amount: t.amount,
    }))

  const expenseItems: BreakdownItem[] = transactions
    .filter((t) => t.type === 'expense' && inRange(t.occurredAt, from, to))
    .map((t) => ({
      date: fmtDate(t.occurredAt),
      label: t.description || t.category,
      sublabel: t.category,
      amount: t.amount,
    }))

  const grossMRRItems: BreakdownItem[] = activeMRR.subscriptions.map((sub) => ({
    label: sub.customerName ?? sub.subscriptionId,
    sublabel: [sub.priceName, sub.interval].filter(Boolean).join(' · ') || undefined,
    amount: sub.monthlyAmount,
  }))

  const monthlyExpenseItems: BreakdownItem[] = [
    ...transactions
      .filter(
        (t) =>
          t.type === 'expense' &&
          inRange(t.occurredAt, mFrom, mTo) &&
          t.externalType !== 'fee',
      )
      .map((t) => ({
        date: fmtDate(t.occurredAt),
        label: t.description || t.category,
        sublabel: t.category,
        amount: t.amount,
      })),
    ...(activeMRR.configured && activeMRR.estimatedFees > 0
      ? [{
          separator: 'Stripe Processing',
          label: `Processing fees (${activeMRR.subscriptionCount} sub${activeMRR.subscriptionCount !== 1 ? 's' : ''})`,
          sublabel: 'est. 2.9% + $0.30 per subscription',
          amount: activeMRR.estimatedFees,
          dim: true,
        }]
      : []),
  ]

  const netMRRItems: BreakdownItem[] = activeMRR.configured
    ? [
        {
          label: 'Gross MRR',
          sublabel: `${activeMRR.subscriptionCount} active subscription${activeMRR.subscriptionCount !== 1 ? 's' : ''}`,
          amount: activeMRR.gross,
        },
        {
          label: 'Monthly Expenses',
          amount: activeMRR.monthlyExpenses,
          prefix: '-',
        },
      ]
    : []

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Top stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => setOpenDialog('income')}
          className="w-full cursor-pointer rounded-xl text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <StatCard
            icon={TrendingUp}
            label="Income"
            value={formatCurrency(summary.totalIncome)}
            subtext="total received"
          />
        </button>

        <button
          type="button"
          onClick={() => setOpenDialog('expenses')}
          className="w-full cursor-pointer rounded-xl text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <StatCard
            icon={TrendingDown}
            label="Expenses"
            value={formatCurrency(summary.totalExpense)}
            subtext="total spent"
          />
        </button>

        <a
          href="#transactions"
          className="block rounded-xl transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <StatCard
            icon={DollarSign}
            label="Net"
            value={`${netIsPositive ? '' : '-'}${formatCurrency(Math.abs(summary.net))}`}
            subtext={netIsPositive ? 'profit · click to view' : 'loss · click to view'}
            highlight={netIsPositive}
          />
        </a>

        <div className="flex items-center rounded-xl border border-border bg-card p-4">
          <SyncStripeButton syncState={syncState} />
        </div>
      </div>

      {/* MRR section */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Monthly Recurring Revenue
        </h2>
        {!activeMRR.configured ? (
          <p className="rounded-xl border border-border bg-card px-4 py-5 text-sm text-muted-foreground">
            Connect your Stripe account in{' '}
            <a href="/settings" className="underline underline-offset-2 hover:text-foreground">
              Settings
            </a>{' '}
            to see your live MRR from active subscriptions.
          </p>
        ) : activeMRR.permissionError ? (
          <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-5 text-sm text-destructive">
            Your Stripe key is missing <strong>Subscriptions: Read</strong> permission. Update it in{' '}
            <a
              href="https://dashboard.stripe.com/apikeys"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Stripe Dashboard → API keys
            </a>{' '}
            then reconnect in{' '}
            <a href="/settings" className="underline underline-offset-2">
              Settings
            </a>
            .
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => setOpenDialog('grossMrr')}
              className="w-full cursor-pointer rounded-xl text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <StatCard
                icon={Repeat2}
                label="Gross MRR"
                value={formatCurrency(activeMRR.gross)}
                subtext={`${activeMRR.subscriptionCount} active subscription${activeMRR.subscriptionCount !== 1 ? 's' : ''}`}
                highlight
              />
            </button>

            <button
              type="button"
              onClick={() => setOpenDialog('monthlyExpenses')}
              className="w-full cursor-pointer rounded-xl text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <StatCard
                icon={Minus}
                label="Monthly Expenses"
                value={`-${formatCurrency(activeMRR.monthlyExpenses)}`}
                subtext="other expenses + est. Stripe fees"
              />
            </button>

            <button
              type="button"
              onClick={() => setOpenDialog('netMrr')}
              className="w-full cursor-pointer rounded-xl text-left transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <StatCard
                icon={DollarSign}
                label="Net MRR"
                value={`${activeMRR.net >= 0 ? '' : '-'}${formatCurrency(Math.abs(activeMRR.net))}`}
                subtext="after expenses"
                highlight={activeMRR.net > 0}
              />
            </button>
          </div>
        )}
      </div>

      {/* Breakdown dialogs */}
      <BreakdownDialog
        open={openDialog === 'income'}
        onClose={close}
        title="Income"
        subtitle={periodLabel(period)}
        items={incomeItems}
        total={summary.totalIncome}
        emptyMessage="No income recorded for this period."
      />
      <BreakdownDialog
        open={openDialog === 'expenses'}
        onClose={close}
        title="Expenses"
        subtitle={periodLabel(period)}
        items={expenseItems}
        total={summary.totalExpense}
        emptyMessage="No expenses recorded for this period."
      />
      <BreakdownDialog
        open={openDialog === 'grossMrr'}
        onClose={close}
        title="Active Subscriptions"
        subtitle="Gross MRR by subscription"
        items={grossMRRItems}
        total={activeMRR.gross}
        totalLabel="Gross MRR"
        emptyMessage="No active subscriptions found."
      />
      <BreakdownDialog
        open={openDialog === 'monthlyExpenses'}
        onClose={close}
        title="Monthly Expenses"
        subtitle="Recorded expenses this month + estimated Stripe fees"
        items={monthlyExpenseItems}
        total={activeMRR.monthlyExpenses}
        emptyMessage="No expenses this month."
      />
      <BreakdownDialog
        open={openDialog === 'netMrr'}
        onClose={close}
        title="Net MRR"
        subtitle="Gross MRR minus monthly expenses"
        items={netMRRItems}
        total={activeMRR.net}
        totalLabel="Net MRR"
        emptyMessage="No MRR data available."
      />
    </>
  )
}
