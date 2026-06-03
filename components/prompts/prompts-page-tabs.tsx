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

  return (
    <div className="flex flex-col">
      {/* Tab bar */}
      <div className="flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors',
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
        {tab === 'generate' && <PromptGeneratorShell defaultAi={defaultAi} />}
        {tab === 'history' && (
          <PromptHistoryList history={initialHistory} defaultAi={defaultAi} />
        )}
        {tab === 'templates' && <TemplateBrowser templates={initialTemplates} />}
      </div>
    </div>
  )
}
