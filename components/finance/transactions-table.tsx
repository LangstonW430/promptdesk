'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, Lock, EyeOff, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { cn } from '@/lib/utils'
import {
  deleteTransactionAction,
  setTransactionHiddenAction,
} from '@/lib/actions/finance'
import { TransactionForm, type ClientOption, type ProjectOption } from './transaction-form'
import type { SerializedTransaction } from '@/lib/finance/serialize'
import type { TransactionFormValues } from '@/lib/finance/validators'

function formatAmount(amount: number, type: string) {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)
  return type === 'income' ? `+${formatted}` : `-${formatted}`
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function toFormValues(t: SerializedTransaction): Partial<TransactionFormValues> {
  return {
    type: t.type as 'income' | 'expense',
    amount: String(t.amount),
    description: t.description ?? '',
    category: t.category,
    occurredAt: t.occurredAt.slice(0, 10),
    clientId: t.clientId ?? '',
    projectId: t.projectId ?? '',
    isRecurring: t.isRecurring,
    // Both of these used to be left out, so opening a standing charge to edit
    // it reset the cadence to the form default and cleared the date it stopped
    // on — the submit then wrote those losses back. Editing a quarterly charge
    // that had ended silently turned it into a live monthly one.
    frequency: (t.frequency ?? 'monthly') as TransactionFormValues['frequency'],
    recurrenceEndedAt: t.recurrenceEndedAt ?? '',
  }
}

type TypeFilter = 'all' | 'income' | 'expense'
type SourceFilter = 'all' | 'manual' | 'stripe'

interface TransactionsTableProps {
  transactions: Array<SerializedTransaction & { isProjected?: boolean }>
  /**
   * Rows the user has taken off the ledger, listed separately so they can be
   * put back. Kept out of `transactions` on purpose: that array is also what
   * the stat cards itemise, and a hidden row appearing there would put money
   * back into the totals it was just removed from.
   */
  hiddenTransactions: SerializedTransaction[]
  clients: ClientOption[]
  projects: ProjectOption[]
}

export function TransactionsTable({
  transactions,
  hiddenTransactions,
  clients,
  projects,
}: TransactionsTableProps) {
  const router = useRouter()
  const [, startTransition] = useTransition()

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<SerializedTransaction | null>(null)
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [pendingHideId, setPendingHideId] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all')

  const filtered = transactions.filter((t) => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false
    if (sourceFilter !== 'all' && t.source !== sourceFilter) return false
    return true
  })

  function openAdd() {
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(t: SerializedTransaction) {
    setEditing(t)
    setSheetOpen(true)
  }

  function handleSuccess() {
    setSheetOpen(false)
    router.refresh()
  }

  // Was a bare window.confirm(): an unstyled OS dialog that blocks the main
  // thread and looks nothing like the rest of the app. ConfirmDialog is what
  // every other destructive path here uses.
  function handleDeleteConfirmed() {
    const id = pendingDeleteId
    if (!id) return
    setPendingDeleteId(null)
    startTransition(async () => {
      await deleteTransactionAction(id)
      router.refresh()
    })
  }

  function handleHideConfirmed() {
    const id = pendingHideId
    if (!id) return
    setPendingHideId(null)
    startTransition(async () => {
      await setTransactionHiddenAction(id, true)
      router.refresh()
    })
  }

  function handleUnhide(id: string) {
    startTransition(async () => {
      await setTransactionHiddenAction(id, false)
      router.refresh()
    })
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Transactions</CardTitle>

          <div className="flex flex-wrap items-center gap-2">
            {/* Type filter */}
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              {(['all', 'income', 'expense'] as TypeFilter[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setTypeFilter(v)}
                  className={cn(
                    'px-2.5 py-1 capitalize transition-colors',
                    typeFilter === v
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>

            {/* Source filter */}
            <div className="flex rounded-md border border-border overflow-hidden text-xs">
              {(['all', 'manual', 'stripe'] as SourceFilter[]).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setSourceFilter(v)}
                  className={cn(
                    'px-2.5 py-1 capitalize transition-colors',
                    sourceFilter === v
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted',
                  )}
                >
                  {v}
                </button>
              ))}
            </div>

            <Button size="sm" onClick={openAdd}>
              <Plus className="mr-1.5 size-4" />
              Add
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">
              No transactions found. Add one to get started.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Transaction list</caption>
                <thead>
                  <tr className="border-b border-border text-xs text-muted-foreground">
                    <th scope="col" className="px-4 py-2 text-left font-medium">Date</th>
                    <th scope="col" className="px-4 py-2 text-left font-medium">Description</th>
                    <th scope="col" className="px-4 py-2 text-left font-medium">Category</th>
                    <th scope="col" className="px-4 py-2 text-left font-medium">Client</th>
                    <th scope="col" className="px-4 py-2 text-left font-medium">Source</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium">Amount</th>
                    <th scope="col" className="px-4 py-2 text-right font-medium sr-only">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr key={`${t.id}-${t.occurredAt}`} className="border-b border-border last:border-0 hover:bg-muted/30">
                      <td className="px-4 py-3 text-muted-foreground tabular-nums whitespace-nowrap">
                        {formatDate(t.occurredAt)}
                      </td>
                      <td className="px-4 py-3 max-w-[200px] truncate">
                        {t.description ?? <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{t.category}</td>
                      <td className="px-4 py-3 text-muted-foreground max-w-[140px] truncate">
                        {t.clientName ?? <span className="text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">
                          {t.source === 'stripe' ? (
                            <span className="inline-flex items-center rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-400">
                              Stripe
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              Manual
                            </span>
                          )}
                          {t.isRecurring && (
                            <span
                              className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                              title={
                                t.isProjected
                                  ? 'A repeat of a standing charge. Edit the original entry to change it.'
                                  : 'Standing charge — repeats every period'
                              }
                            >
                              {t.frequency === 'quarterly' ? 'Quarterly'
                                : t.frequency === 'annual' ? 'Annual'
                                : 'Monthly'}
                              {t.isProjected && ' · repeat'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td
                        className={cn(
                          'px-4 py-3 text-right tabular-nums font-medium whitespace-nowrap',
                          t.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400',
                        )}
                      >
                        {formatAmount(t.amount, t.type)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {/* A repeat has no row of its own to act on; the
                            original entry is where it is edited or removed. */}
                        {t.isProjected ? (
                          <Lock
                            className="ml-auto size-3.5 text-muted-foreground/40"
                            aria-label="Repeat of a standing charge — edit the original entry"
                          />
                        ) : (
                          <div className="flex justify-end gap-1">
                            {/* Stripe rows are editable too. Their amount, type
                                and currency stay read-only in the form, but the
                                category, client, project and — the reason this
                                matters — whether the charge still recurs are
                                the user's to set. Locking the whole row left a
                                cancelled subscription counting toward MRR with
                                no way to say it had stopped. */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-7"
                              onClick={() => openEdit(t)}
                              aria-label={
                                t.source === 'stripe'
                                  ? 'Edit imported transaction'
                                  : 'Edit transaction'
                              }
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            {t.source === 'stripe' ? (
                              // Deleting an imported row does not remove it —
                              // the next sync reads the same charge from Stripe
                              // and writes it back. Hiding is reversible and
                              // actually sticks.
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7"
                                onClick={() => setPendingHideId(t.id)}
                                aria-label="Hide transaction from the ledger"
                              >
                                <EyeOff className="size-3.5" />
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 text-destructive hover:text-destructive"
                                onClick={() => setPendingDeleteId(t.id)}
                                aria-label="Delete transaction"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Hidden rows — collapsed by default so the ledger reads as the
              user left it, but never silently discarded. */}
          {hiddenTransactions.length > 0 && (
            <div className="border-t border-border px-4 py-3">
              <button
                type="button"
                onClick={() => setShowHidden((v) => !v)}
                aria-expanded={showHidden}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <EyeOff className="size-3.5" />
                {hiddenTransactions.length} hidden{' '}
                {hiddenTransactions.length === 1 ? 'row' : 'rows'}
                <span aria-hidden="true">{showHidden ? '▾' : '▸'}</span>
              </button>

              {showHidden && (
                <ul className="mt-3 flex flex-col gap-1.5">
                  {hiddenTransactions.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-xs"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
                        <span className="tabular-nums whitespace-nowrap">
                          {formatDate(t.occurredAt)}
                        </span>
                        <span className="truncate">
                          {t.description ?? t.category}
                        </span>
                        <span className="tabular-nums whitespace-nowrap">
                          {formatAmount(t.amount, t.type)}
                        </span>
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 shrink-0 text-xs"
                        onClick={() => handleUnhide(t.id)}
                      >
                        <Eye className="mr-1.5 size-3.5" />
                        Unhide
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent className="flex flex-col sm:max-w-md p-0">
          <SheetHeader className="border-b border-border px-6 py-4 shrink-0">
            <SheetTitle>{editing ? 'Edit transaction' : 'Add transaction'}</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-5">
            <TransactionForm
              clients={clients}
              projects={projects}
              defaultValues={editing ? toFormValues(editing) : undefined}
              transactionId={editing?.id}
              financialsLocked={editing?.source === 'stripe'}
              onSuccess={handleSuccess}
              onCancel={() => setSheetOpen(false)}
            />
          </div>
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => { if (!open) setPendingDeleteId(null) }}
        title="Delete transaction?"
        description="This permanently removes the transaction and the figures it feeds on the Finance page. This cannot be undone."
        confirmLabel="Delete transaction"
        variant="destructive"
        onConfirm={handleDeleteConfirmed}
      />

      <ConfirmDialog
        open={pendingHideId !== null}
        onOpenChange={(open) => { if (!open) setPendingHideId(null) }}
        title="Hide this transaction?"
        description="It comes out of the transactions list and every total on this page. Imported rows cannot be deleted — the next Stripe sync would bring them straight back — so this hides it instead. You can unhide it at any time."
        confirmLabel="Hide transaction"
        onConfirm={handleHideConfirmed}
      />
    </>
  )
}
