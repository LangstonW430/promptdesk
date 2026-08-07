'use client'

import { useTransition } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, Loader2 } from 'lucide-react'
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
import { createTransactionAction, updateTransactionAction } from '@/lib/actions/finance'

export type ClientOption = { id: string; name: string }

interface TransactionFormProps {
  clients: ClientOption[]
  defaultValues?: Partial<TransactionFormValues>
  transactionId?: string
  onSuccess: () => void
  onCancel: () => void
}

function toActionPayload(values: TransactionFormValues) {
  return {
    type: values.type as 'income' | 'expense',
    amount: Number(values.amount),
    description: values.description || undefined,
    category: values.category,
    occurredAt: values.occurredAt,
    clientId: values.clientId || undefined,
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
  defaultValues,
  transactionId,
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
  const categoryOptions =
    watchedType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES

  async function onSubmit(values: TransactionFormValues) {
    const payload = toActionPayload(values)
    startTransition(async () => {
      const result = isEdit
        ? await updateTransactionAction(transactionId, payload)
        : await createTransactionAction(payload)

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

        {/* Date */}
        <FormField
          control={form.control}
          name="occurredAt"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date</FormLabel>
              <FormControl>
                <Input {...field} type="date" />
              </FormControl>
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
                  <Select {...field}>
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
