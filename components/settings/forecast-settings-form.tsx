'use client'

import { useState, useTransition } from 'react'
import { Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updateUserSettingsAction } from '@/lib/actions/users'

const TOKEN_BUDGET_OPTIONS = [
  { value: 2000, label: '2,000 — Short context (GPT-3.5, quick reads)' },
  { value: 3000, label: '3,000 — Medium context' },
  { value: 4000, label: '4,000 — Default' },
  { value: 6000, label: '6,000 — Large context' },
  { value: 8000, label: '8,000 — Maximum detail' },
]

export interface PromptSettingsProps {
  tokenBudget: number
}

export function PromptSettingsForm({ tokenBudget: initialBudget }: PromptSettingsProps) {
  const [tokenBudget, setTokenBudget] = useState(initialBudget)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await updateUserSettingsAction({ tokenBudget })
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
      <h2 className="text-base font-semibold">Prompt Settings</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Controls how much context is packed into generated prompts.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tokenBudget" className="text-sm font-medium">Token budget</label>
          <p className="text-xs text-muted-foreground">
            Maximum context tokens included in each generated prompt. Raise this for models with large context windows; lower it if prompts feel too long.
          </p>
          <select
            id="tokenBudget"
            value={tokenBudget}
            onChange={(e) => setTokenBudget(Number(e.target.value))}
            disabled={isPending}
            className="mt-1 h-9 rounded-lg border border-input bg-background px-3 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
          >
            {TOKEN_BUDGET_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
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
