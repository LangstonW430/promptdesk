'use client'

import { useState, useTransition } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  transactionFormSchema,
  transactionFormDefaultValues,
  type TransactionFormValues,
} from '@/lib/finance/validators'
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '@/lib/finance/categories'
import {
  createTransactionAction,
  updateTransactionAction,
  supersedeStandingChargeAction,
} from '@/lib/actions/finance'

export type ClientOption = { id: string; name: string }

/**
 * A project a transaction can be attributed to. `clientId` is carried so the
 * picker can narrow to the selected client's work rather than listing every
 * project the user has.
 */
export type ProjectOption = { id: string; title: string; clientId: string }

interface TransactionFormProps {
  clients: ClientOption[]
  projects: ProjectOption[]
  defaultValues?: Partial<TransactionFormValues>
  transactionId?: string
  /**
   * True for a Stripe-imported row. What money changed hands is Stripe's
   * record, so type, amount and currency are shown but not editable — the
   * server ignores them for these rows regardless. Everything else on the form
   * is the user's own bookkeeping and stays editable.
   */
  financialsLocked?: boolean
  onSuccess: () => void
  onCancel: () => void
}

/** Today in UTC as YYYY-MM-DD — the form the date inputs and the API use. */
function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

/**
 * What a rate change sends: the new figures, plus the date they took effect.
 * The start date is deliberately absent — the charge keeps the one it has, and
 * the new rate begins its own charge on `effectiveFrom`.
 */
function toRateChangePayload(values: TransactionFormValues, effectiveFrom: string) {
  return {
    effectiveFrom,
    type: values.type as 'income' | 'expense',
    amount: Number(values.amount),
    description: values.description || null,
    category: values.category,
    clientId: values.clientId || null,
    projectId: values.projectId || null,
    frequency: (values.frequency || 'monthly') as 'monthly' | 'quarterly' | 'annual',
  }
}

function toActionPayload(values: TransactionFormValues) {
  return {
    type: values.type as 'income' | 'expense',
    amount: Number(values.amount),
    description: values.description || undefined,
    category: values.category,
    occurredAt: values.occurredAt,
    clientId: values.clientId || undefined,
    projectId: values.projectId || undefined,
    isRecurring: values.isRecurring,
    recurrenceEndedAt: values.isRecurring
      ? (values.recurrenceEndedAt || null)
      : null,
    frequency: values.isRecurring && values.frequency
      ? (values.frequency as 'monthly' | 'quarterly' | 'annual')
      : undefined,
  }
}

export function TransactionForm({
  clients,
  projects,
  defaultValues,
  transactionId,
  financialsLocked = false,
  onSuccess,
  onCancel,
}: TransactionFormProps) {
  const [isPending, startTransition] = useTransition()
  const isEdit = !!transactionId

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: { ...transactionFormDefaultValues, ...defaultValues },
  })

  const watchedType = useWatch({ control: form.control, name: 'type' })
  const watchedRecurring = useWatch({ control: form.control, name: 'isRecurring' })
  const watchedClientId = useWatch({ control: form.control, name: 'clientId' })
  const watchedAmount = useWatch({ control: form.control, name: 'amount' })
  const watchedFrequency = useWatch({ control: form.control, name: 'frequency' })

  // How a changed price should be applied. Not a form field: it is a question
  // about the edit rather than a property of the charge, and it only exists
  // while the figures on screen differ from the ones that were loaded.
  const [rateChange, setRateChange] = useState<'from' | 'always'>('from')
  const [effectiveFrom, setEffectiveFrom] = useState(todayISO())

  /**
   * True when this edit changes what the charge costs per period.
   *
   * A standing charge is a single row that every month it covers reads its
   * figure from, so saving a new amount restates months that were billed at
   * the old one — the subscription that went up a tier in August suddenly
   * costs the higher price back in May too. That is right for a typo and
   * wrong for a plan change, and only the user knows which this is.
   */
  const startedAt = defaultValues?.occurredAt ?? ''
  const isStandingCharge = isEdit && defaultValues?.isRecurring === true && watchedRecurring
  const figuresChanged =
    isStandingCharge &&
    !financialsLocked &&
    (Number(watchedAmount) !== Number(defaultValues?.amount ?? NaN) ||
      watchedFrequency !== (defaultValues?.frequency ?? 'monthly'))

  // Only the selected client's work. With no client chosen there is nothing to
  // attribute to, so the picker stays hidden rather than offering every project.
  const selectedClientProjects = watchedClientId
    ? projects.filter((p) => p.clientId === watchedClientId)
    : []
  const categoryOptions =
    watchedType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  async function onSubmit(values: TransactionFormValues) {
    startTransition(async () => {
      // A rate change is its own operation: it stops the old rate the month
      // before and starts the new one as a charge of its own, leaving the
      // months already billed at the old price alone.
      const result =
        figuresChanged && rateChange === 'from'
          ? await supersedeStandingChargeAction(
              transactionId,
              toRateChangePayload(values, effectiveFrom),
            )
          : isEdit
            ? await updateTransactionAction(transactionId, toActionPayload(values))
            : await createTransactionAction(toActionPayload(values))

      if (!result.success) {
        form.setError('root', { message: result.error })
        return
      }
      onSuccess()
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex flex-col gap-5">
        {form.formState.errors.root && (
          <div className="flex items-start gap-2.5 rounded-lg border border-destructive/50 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {form.formState.errors.root.message}
          </div>
        )}

        {financialsLocked && (
          <p className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
            <Lock className="mt-0.5 size-3.5 shrink-0" />
            <span>
              Imported from Stripe. The amount and type are Stripe&apos;s record
              and cannot be changed here — everything else is yours to edit. To
              stop a cancelled subscription counting toward MRR, set{' '}
              <strong>Stopped on</strong> below.
            </span>
          </p>
        )}

        {/* Type */}
        <FormField
          control={form.control}
          name="type"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <FormControl>
                <Select
                  {...field}
                  disabled={financialsLocked}
                  onChange={(e) => {
                    field.onChange(e)
                    // Reset category when type changes if it's no longer valid
                    const newType = e.target.value
                    const current = form.getValues('category')
                    const stillValid =
                      newType === 'income'
                        ? (INCOME_CATEGORIES as readonly string[]).includes(current)
                        : (EXPENSE_CATEGORIES as readonly string[]).includes(current)
                    if (!stillValid) form.setValue('category', '')
                  }}
                >
                  <option value="income">Income</option>
                  <option value="expense">Expense</option>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Amount */}
        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Amount</FormLabel>
              <FormControl>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground text-sm">
                    $
                  </span>
                  <Input
                    {...field}
                    type="number"
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    className="pl-7"
                    disabled={financialsLocked}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Category */}
        <FormField
          control={form.control}
          name="category"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category</FormLabel>
              <FormControl>
                <Select {...field}>
                  <option value="">— Select category —</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Date — for a standing charge this is when it began, not one of the
            months it lands in, and saying so matters when the form was opened
            from a repeat several months later. */}
        <FormField
          control={form.control}
          name="occurredAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{watchedRecurring ? 'Started on' : 'Date'}</FormLabel>
              <FormControl>
                <Input {...field} type="date" />
              </FormControl>
              {watchedRecurring && (
                <p className="text-xs text-muted-foreground">
                  The first month this charge applied. It repeats from here.
                </p>
              )}
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                Description{' '}
                <span className="text-xs text-muted-foreground font-normal">(optional)</span>
              </FormLabel>
              <FormControl>
                <Input {...field} placeholder="e.g. Monthly hosting fee" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Recurring */}
        <FormField
          control={form.control}
          name="isRecurring"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center gap-2.5">
                <FormControl>
                  <input
                    id="isRecurring"
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="size-4 rounded border-border accent-primary"
                  />
                </FormControl>
                <label htmlFor="isRecurring" className="text-sm font-medium cursor-pointer select-none">
                  Recurring (counts toward MRR)
                </label>
              </div>
              <p className="text-xs text-muted-foreground pl-6">
                For manual retainers or subscriptions not billed through Stripe.
                Stripe Subscription payments are detected automatically.
              </p>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Frequency — only shown when recurring is checked */}
        {watchedRecurring && (
          <FormField
            control={form.control}
            name="frequency"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Billing frequency</FormLabel>
                <FormControl>
                  <Select {...field}>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="annual">Annual</option>
                  </Select>
                </FormControl>
                <p className="text-xs text-muted-foreground pl-0">
                  Used to normalize this payment to a monthly MRR figure.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Ended — only meaningful for a recurring charge */}
        {watchedRecurring && (
          <FormField
            control={form.control}
            name="recurrenceEndedAt"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Stopped on (optional)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <p className="text-xs text-muted-foreground pl-0">
                  Set this when the charge ends instead of deleting it — the
                  months it did apply to keep counting it.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* The figures on a standing charge changed. Which of the two things
            that can mean is a question only the user can answer, so it is
            asked here rather than guessed — and the answer that protects
            already-billed months is the default. */}
        {figuresChanged && (
          <fieldset className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 px-3 py-3">
            <legend className="px-1 text-xs font-medium">
              How should the new amount apply?
            </legend>

            <label className="flex items-start gap-2.5 text-xs cursor-pointer">
              <input
                type="radio"
                name="rateChange"
                className="mt-0.5 size-3.5 accent-primary"
                checked={rateChange === 'from'}
                onChange={() => setRateChange('from')}
              />
              <span>
                <span className="font-medium text-foreground">
                  The price changed on a date
                </span>
                <span className="block text-muted-foreground">
                  Stops this charge the month before and starts the new amount
                  from then. Months already billed at the old price keep it.
                </span>
              </span>
            </label>

            {rateChange === 'from' && (
              <div className="pl-6">
                <label
                  htmlFor="effectiveFrom"
                  className="block text-xs text-muted-foreground mb-1"
                >
                  New price applies from
                </label>
                <input
                  id="effectiveFrom"
                  type="date"
                  value={effectiveFrom}
                  min={startedAt || undefined}
                  onChange={(e) => setEffectiveFrom(e.target.value)}
                  className="h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
                />
              </div>
            )}

            <label className="flex items-start gap-2.5 text-xs cursor-pointer">
              <input
                type="radio"
                name="rateChange"
                className="mt-0.5 size-3.5 accent-primary"
                checked={rateChange === 'always'}
                onChange={() => setRateChange('always')}
              />
              <span>
                <span className="font-medium text-foreground">
                  It was always this amount
                </span>
                <span className="block text-muted-foreground">
                  Corrects the charge everywhere, back to
                  {startedAt ? ` ${startedAt}` : ' the day it started'}. Use
                  this to fix a figure that was entered wrong.
                </span>
              </span>
            </label>
          </fieldset>
        )}

        {/* Client */}
        {clients.length > 0 && (
          <FormField
            control={form.control}
            name="clientId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Client{' '}
                  <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Select
                    {...field}
                    onChange={(e) => {
                      field.onChange(e)
                      // The project belongs to the old client, so keeping it
                      // would file this money against someone else's work.
                      form.setValue('projectId', '')
                    }}
                  >
                    <option value="">— No client —</option>
                    {clients.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Project — only once a client is chosen, and only if they have work */}
        {selectedClientProjects.length > 0 && (
          <FormField
            control={form.control}
            name="projectId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>
                  Project{' '}
                  <span className="text-xs text-muted-foreground font-normal">(optional)</span>
                </FormLabel>
                <FormControl>
                  <Select {...field}>
                    <option value="">— No project —</option>
                    {selectedClientProjects.map((p) => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                  </Select>
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  Attributing money to a project is what lets the project report
                  what it earned against its budget.
                </p>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Add transaction'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
