'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, AlertCircle, Loader2, ExternalLink, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { saveStripeKeyAction, removeStripeKeyAction } from '@/lib/actions/stripe-settings'

interface StripeSettingsProps {
  connected: boolean
  hint: string | null  // last-4 chars of the key, e.g. "xyzw"
}

export function StripeSettings({ connected: initialConnected, hint }: StripeSettingsProps) {
  const [connected, setConnected] = useState(initialConnected)
  const [key, setKey] = useState('')
  const [error, setError] = useState<string | null>(null)
  // Things that worked but are limited — a key that imports transactions yet
  // cannot raise invoices, or a deployment Stripe cannot reach. Neither should
  // fail the save, and neither should pass silently.
  const [warnings, setWarnings] = useState<string[]>([])
  const [saved, setSaved] = useState(false)
  const [isSaving, startSave] = useTransition()
  const [isRemoving, startRemove] = useTransition()

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setWarnings([])
    setSaved(false)
    startSave(async () => {
      const result = await saveStripeKeyAction(key)
      if (!result.success) {
        setError(result.error)
        return
      }
      setConnected(true)
      setKey('')
      setWarnings(result.warnings)
      setSaved(true)
      // Warnings need reading, so they stay put. Only the success note clears.
      setTimeout(() => setSaved(false), 3000)
    })
  }

  function handleRemove() {
    if (
      !confirm(
        'Remove your Stripe key? Invoices already raised stay live in Stripe and ' +
          'your clients can still pay them, but this app will stop updating them. ' +
          'Existing imported transactions remain.',
      )
    ) {
      return
    }
    setError(null)
    setWarnings([])
    setSaved(false)
    startRemove(async () => {
      await removeStripeKeyAction()
      setConnected(false)
    })
  }

  const isPending = isSaving || isRemoving

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold">Stripe</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Bill clients through Stripe and import your charges as income
            automatically. Stripe raises, sends and collects on every invoice.
          </p>
        </div>

        {/* Status badge */}
        {connected ? (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            Connected {hint ? `···${hint}` : ''}
          </span>
        ) : (
          <span className="flex shrink-0 items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
            Not connected
          </span>
        )}
      </div>

      {/* Key entry form */}
      <form onSubmit={handleSave} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="stripe-key" className="text-sm font-medium">
            Restricted API key
          </label>
          <Input
            id="stripe-key"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={connected ? 'Paste a new key to replace the existing one' : 'rk_live_... or rk_test_...'}
            autoComplete="off"
            spellCheck={false}
            className="font-mono text-sm"
          />
          <div className="text-xs text-muted-foreground">
            <p>
              Create a{' '}
              <a
                href="https://dashboard.stripe.com/apikeys"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-0.5 underline underline-offset-2 hover:text-foreground"
              >
                restricted key
                <ExternalLink className="size-3" />
              </a>{' '}
              with these permissions. Never use your full secret key.
            </p>
            {/* The old copy asked only for Read scopes, which is enough to
                import transactions but cannot raise an invoice — so anyone who
                followed it hit a permission error at the moment they tried to
                bill a client. */}
            <ul className="mt-2 flex flex-col gap-1">
              <li>
                <strong>Read</strong> — Charges, Balance transactions, Subscriptions
              </li>
              <li>
                <strong>Write</strong> — Invoices, Customers, Tax Rates
                <span className="text-muted-foreground/70"> (to bill clients)</span>
              </li>
              <li>
                <strong>Write</strong> — Webhook Endpoints
                <span className="text-muted-foreground/70">
                  {' '}
                  (so payments update automatically)
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Feedback */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}
        {saved && (
          <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-400">
            <CheckCircle2 className="size-4 shrink-0" />
            Connected! Your transactions have been imported — check the Finance page.
          </div>
        )}
        {warnings.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/20 dark:text-amber-300">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <div className="flex flex-col gap-1.5">
              <p className="font-medium">Connected, with limitations</p>
              {warnings.map((w) => (
                <p key={w} className="leading-relaxed">{w}</p>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={!key.trim() || isPending}>
            {isSaving && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isSaving
              ? 'Connecting & importing…'
              : connected
                ? 'Update key'
                : 'Connect Stripe'}
          </Button>

          {connected && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              disabled={isPending}
              onClick={handleRemove}
            >
              {isRemoving ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Remove
            </Button>
          )}
        </div>
      </form>
    </div>
  )
}
