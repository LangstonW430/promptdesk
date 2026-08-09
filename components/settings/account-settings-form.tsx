'use client'

import { useState, useTransition } from 'react'
import { Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updateUserProfileAction } from '@/lib/actions/users'

const AI_OPTIONS = [
  { value: 'chatgpt', label: 'ChatGPT' },
  { value: 'claude', label: 'Claude' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'perplexity', label: 'Perplexity' },
  { value: 'grok', label: 'Grok' },
]

export interface AccountSettingsProps {
  email: string
  fullName: string | null
  businessName: string | null
  businessType: string | null
  defaultAi: string | null
  businessAddress: string | null
  businessPhone: string | null
  taxNumber: string | null
  defaultPaymentTerms: string | null
}

/** Common terms, offered rather than typed. Free text is still allowed. */
const TERMS_OPTIONS = [
  'Due on receipt',
  'Net 7',
  'Net 14',
  'Net 30',
  'Net 60',
]

export function AccountSettingsForm({
  email,
  fullName: initialFullName,
  businessName: initialBusinessName,
  businessType: initialBusinessType,
  defaultAi: initialDefaultAi,
  businessAddress: initialAddress,
  businessPhone: initialPhone,
  taxNumber: initialTaxNumber,
  defaultPaymentTerms: initialTerms,
}: AccountSettingsProps) {
  const [fullName, setFullName] = useState(initialFullName ?? '')
  const [businessName, setBusinessName] = useState(initialBusinessName ?? '')
  const [businessType, setBusinessType] = useState(initialBusinessType ?? '')
  const [defaultAi, setDefaultAi] = useState(initialDefaultAi ?? '')
  const [businessAddress, setBusinessAddress] = useState(initialAddress ?? '')
  const [businessPhone, setBusinessPhone] = useState(initialPhone ?? '')
  const [taxNumber, setTaxNumber] = useState(initialTaxNumber ?? '')
  const [defaultPaymentTerms, setDefaultPaymentTerms] = useState(initialTerms ?? '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateUserProfileAction({
        fullName: fullName || undefined,
        businessName: businessName || undefined,
        businessType: businessType || undefined,
        defaultAi: defaultAi || undefined,
        // Empty string clears the field rather than leaving the old value in
        // place, so a detail can actually be removed from future invoices.
        businessAddress,
        businessPhone,
        taxNumber,
        defaultPaymentTerms,
      })
      if (result.error) {
        setError(result.error)
      } else {
        setSaved(true)
        setTimeout(() => setSaved(false), 2500)
      }
    })
  }

  return (
    <div>
      <h2 className="text-base font-semibold">Account</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Your profile details are included as context in every generated prompt.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        {/* Email — read-only */}
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-medium">Email</label>
          <input
            type="email"
            value={email}
            disabled
            className="h-9 w-full rounded-lg border border-input bg-muted px-3 text-sm text-muted-foreground opacity-70"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="fullName" className="text-sm font-medium">Full name</label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Smith"
              disabled={isPending}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="businessName" className="text-sm font-medium">Business name</label>
            <input
              id="businessName"
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Smith Creative Studio"
              disabled={isPending}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="businessType" className="text-sm font-medium">Business type</label>
            <input
              id="businessType"
              type="text"
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              placeholder="e.g. web development, design, consulting"
              disabled={isPending}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="defaultAi" className="text-sm font-medium">Preferred AI</label>
            <select
              id="defaultAi"
              value={defaultAi}
              onChange={(e) => setDefaultAi(e.target.value)}
              disabled={isPending}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
            >
              <option value="">— None selected —</option>
              {AI_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── Billing details ──────────────────────────────────────────
            Printed in the "From" block of every invoice a client opens. An
            invoice without a supplier address is not a valid commercial
            document in most places. */}
        <fieldset className="mt-2 flex flex-col gap-4 border-t border-border pt-5">
          <legend className="sr-only">Billing details</legend>
          <div>
            <p className="text-sm font-medium">Billing details</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Shown on every invoice your clients open. Without an address and a
              tax number, an invoice is not a document their bookkeeper can file.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="businessAddress" className="text-sm font-medium">
              Business address
            </label>
            <textarea
              id="businessAddress"
              rows={3}
              value={businessAddress}
              onChange={(e) => setBusinessAddress(e.target.value)}
              placeholder={'123 Example St\nPortland, OR 97201\nUnited States'}
              disabled={isPending}
              className="resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="businessPhone" className="text-sm font-medium">Phone</label>
              <input
                id="businessPhone"
                type="tel"
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
                placeholder="+1 555 000 0000"
                disabled={isPending}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="taxNumber" className="text-sm font-medium">
                Tax number{' '}
                <span className="text-xs font-normal text-muted-foreground">(EIN / VAT)</span>
              </label>
              <input
                id="taxNumber"
                type="text"
                value={taxNumber}
                onChange={(e) => setTaxNumber(e.target.value)}
                placeholder="12-3456789"
                disabled={isPending}
                className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="defaultPaymentTerms" className="text-sm font-medium">
              Default payment terms
            </label>
            <input
              id="defaultPaymentTerms"
              list="terms-options"
              value={defaultPaymentTerms}
              onChange={(e) => setDefaultPaymentTerms(e.target.value)}
              placeholder="Net 30"
              disabled={isPending}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
            />
            <datalist id="terms-options">
              {TERMS_OPTIONS.map((t) => <option key={t} value={t} />)}
            </datalist>
            <p className="text-xs text-muted-foreground">
              Prefilled on new invoices. Each invoice keeps its own copy, so
              changing this never alters one you have already sent.
            </p>
          </div>
        </fieldset>

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" /> : saved ? <Check /> : null}
            {isPending ? 'Saving…' : saved ? 'Saved' : 'Save changes'}
          </Button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      </form>
    </div>
  )
}
