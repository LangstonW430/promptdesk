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
}

export function AccountSettingsForm({
  email,
  fullName: initialFullName,
  businessName: initialBusinessName,
  businessType: initialBusinessType,
  defaultAi: initialDefaultAi,
}: AccountSettingsProps) {
  const [fullName, setFullName] = useState(initialFullName ?? '')
  const [businessName, setBusinessName] = useState(initialBusinessName ?? '')
  const [businessType, setBusinessType] = useState(initialBusinessType ?? '')
  const [defaultAi, setDefaultAi] = useState(initialDefaultAi ?? '')
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
