'use client'

import { useState } from 'react'
import { Sparkles, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PromptResultPanel } from './prompt-result-panel'
import { usePromptGenerator } from '@/lib/prompts/use-prompt-generator'

const EMAIL_TEMPLATES = [
  {
    key: 'follow_up_email',
    label: 'Follow-up Email',
    description: 'After a meeting or proposal with no response yet.',
  },
  {
    key: 'proposal_cover_letter',
    label: 'Proposal Cover Letter',
    description: 'Intro email sent alongside a proposal or quote.',
  },
  {
    key: 'check_in_email',
    label: 'Check-in Email',
    description: 'Light touch for a quiet client — keep the relationship warm.',
  },
  {
    key: 'closing_email',
    label: 'Closing Email',
    description: 'Push a warm lead toward a decision, gently.',
  },
] as const

type EmailTemplateKey = (typeof EMAIL_TEMPLATES)[number]['key']

interface ClientEmailPanelProps {
  clientId: string
  /** Pre-fills the Gmail "To:" field when the Gmail button is clicked. */
  clientEmail?: string | null
  defaultAi?: string | null
}

export function ClientEmailPanel({
  clientId,
  clientEmail,
  defaultAi,
}: ClientEmailPanelProps) {
  const [selectedKey, setSelectedKey] = useState<EmailTemplateKey>('follow_up_email')
  const { result, loading, error, generate } = usePromptGenerator()

  const selected = EMAIL_TEMPLATES.find((t) => t.key === selectedKey)!

  return (
    <div className="flex flex-col gap-3">
      {/* Template picker */}
      <div className="flex items-start gap-2">
        <select
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value as EmailTemplateKey)}
          disabled={loading}
          aria-label="Email template"
          className="flex-1 h-8 rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
        >
          {EMAIL_TEMPLATES.map((t) => (
            <option key={t.key} value={t.key}>
              {t.label}
            </option>
          ))}
        </select>

        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            generate({ templateKey: selectedKey, scope: 'client', clientId })
          }
          disabled={loading}
          className="shrink-0 gap-1.5"
        >
          {loading ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          {loading ? 'Generating…' : 'Generate'}
        </Button>
      </div>

      {/* Template description */}
      <p className="text-xs text-muted-foreground leading-relaxed">{selected.description}</p>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <PromptResultPanel
          text={result.text}
          tokenCount={result.tokenCount}
          contextMeta={result.contextMeta}
          defaultAi={defaultAi}
          gmailTo={clientEmail}
        />
      )}
    </div>
  )
}
