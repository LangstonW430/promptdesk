'use client'

import { useState } from 'react'
import { Pencil, Sparkles, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScopeBadge } from '@/components/dashboard/scope-badge'
import { TemplateEditorSheet } from './template-editor-sheet'
import { cn } from '@/lib/utils'

export interface TemplateItem {
  id: string | null
  key: string
  name: string
  description: string | null
  scope: string
  version: number
  tokenBudget: number
  body: string
  isCustom: boolean
}

const SCOPE_ORDER = ['global', 'client', 'notes'] as const

const SCOPE_LABELS: Record<string, string> = {
  global: 'Global',
  client: 'Client',
  notes: 'Notes',
}

const SCOPE_DESCRIPTIONS: Record<string, string> = {
  global: 'Generate from your full pipeline data',
  client: 'Scoped to a single client — use from the client detail page',
  notes: 'Analyses a client\'s notes — use from the client detail page',
}

interface TemplateBrowserProps {
  templates: TemplateItem[]
}

export function TemplateBrowser({ templates: initial }: TemplateBrowserProps) {
  const [templates, setTemplates] = useState(initial)
  const [editing, setEditing] = useState<TemplateItem | null>(null)

  function handleSave(updated: TemplateItem) {
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.key === updated.key)
      if (idx >= 0) {
        const next = [...prev]
        next[idx] = updated
        return next
      }
      return [updated, ...prev]
    })
    setEditing(null)
  }

  const byScope = SCOPE_ORDER.map((scope) => ({
    scope,
    items: templates.filter((t) => t.scope === scope),
  })).filter((g) => g.items.length > 0)

  const customCount = templates.filter((t) => t.isCustom).length

  return (
    <>
      <div className="flex flex-col gap-6">
        {/* Summary */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {templates.length} template{templates.length === 1 ? '' : 's'} available
            {customCount > 0 && ` · ${customCount} customised`}
          </p>
        </div>

        {byScope.map(({ scope, items }) => (
          <div key={scope} className="flex flex-col gap-3">
            {/* Section header */}
            <div>
              <h3 className="text-sm font-semibold">{SCOPE_LABELS[scope]} templates</h3>
              <p className="text-xs text-muted-foreground">{SCOPE_DESCRIPTIONS[scope]}</p>
            </div>

            {/* Template rows */}
            <div className="overflow-hidden rounded-xl border border-border">
              {items.map((t, idx) => (
                <div
                  key={t.key}
                  className={cn(
                    'flex items-start gap-3 px-4 py-3',
                    idx < items.length - 1 && 'border-b border-border',
                  )}
                >
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{t.name}</span>
                      <ScopeBadge scope={t.scope} />
                      <span className="text-xs text-muted-foreground">v{t.version}</span>
                      {t.isCustom && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                          <CheckCircle2 className="size-2.5" />
                          Customised
                        </span>
                      )}
                    </div>
                    {t.description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {t.description}
                      </p>
                    )}
                  </div>

                  {/* Action */}
                  <Button
                    size="sm"
                    variant={t.isCustom ? 'secondary' : 'outline'}
                    onClick={() => setEditing(t)}
                    className="shrink-0"
                  >
                    {t.isCustom ? (
                      <>
                        <Pencil className="size-3" />
                        Edit
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3" />
                        Customize
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <TemplateEditorSheet
        template={editing}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />
    </>
  )
}
