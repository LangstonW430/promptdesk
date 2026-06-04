'use client'

import { useState } from 'react'
import { PromptGeneratorShell } from './prompt-generator-shell'
import { PromptHistoryList, type HistoryItem } from './prompt-history-list'
import { TemplateBrowser, type TemplateItem } from './template-browser'
import { cn } from '@/lib/utils'

type Tab = 'generate' | 'history' | 'templates'

interface PromptsPageTabsProps {
  defaultAi: string | null
  initialHistory: HistoryItem[]
  initialTemplates: TemplateItem[]
}

export function PromptsPageTabs({
  defaultAi,
  initialHistory,
  initialTemplates,
}: PromptsPageTabsProps) {
  const [tab, setTab] = useState<Tab>('generate')

  const tabs: { key: Tab; label: string; count?: number }[] = [
    { key: 'generate', label: 'Generate' },
    { key: 'history', label: 'History', count: initialHistory.length || undefined },
    { key: 'templates', label: 'Templates', count: initialTemplates.length || undefined },
  ]

  function handleKeyDown(e: React.KeyboardEvent, currentKey: Tab) {
    const keys = tabs.map((t) => t.key)
    const idx = keys.indexOf(currentKey)
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      setTab(keys[(idx + 1) % keys.length])
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setTab(keys[(idx - 1 + keys.length) % keys.length])
    }
  }

  return (
    <div className="flex flex-col">
      {/* Tab bar */}
      <div role="tablist" aria-label="Prompts sections" className="flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            id={`tab-${t.key}`}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            aria-controls={`panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            onClick={() => setTab(t.key)}
            onKeyDown={(e) => handleKeyDown(e, t.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:rounded-sm',
              tab === t.key
                ? '-mb-px border-b-2 border-primary text-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t.label}
            {t.count != null && (
              <span className="rounded-full bg-muted px-1.5 py-px text-xs text-muted-foreground">
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="pt-6">
        <div
          role="tabpanel"
          id="panel-generate"
          aria-labelledby="tab-generate"
          tabIndex={0}
          hidden={tab !== 'generate'}
          className="focus-visible:outline-none"
        >
          <PromptGeneratorShell defaultAi={defaultAi} />
        </div>
        <div
          role="tabpanel"
          id="panel-history"
          aria-labelledby="tab-history"
          tabIndex={0}
          hidden={tab !== 'history'}
          className="focus-visible:outline-none"
        >
          <PromptHistoryList history={initialHistory} defaultAi={defaultAi} />
        </div>
        <div
          role="tabpanel"
          id="panel-templates"
          aria-labelledby="tab-templates"
          tabIndex={0}
          hidden={tab !== 'templates'}
          className="focus-visible:outline-none"
        >
          <TemplateBrowser templates={initialTemplates} />
        </div>
      </div>
    </div>
  )
}
