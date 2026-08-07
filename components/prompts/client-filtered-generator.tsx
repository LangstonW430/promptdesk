'use client'

import { useState, useMemo } from 'react'
import { Sparkles, Loader2, Search, X, Check, AlertCircle, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PromptResultPanel } from './prompt-result-panel'
import { usePromptGenerator } from '@/lib/prompts/use-prompt-generator'
import { cn } from '@/lib/utils'

const SINGLE_CLIENT_TEMPLATES = [
  { key: 'client_insight', label: 'Client Insight', scope: 'client' as const, needsObjective: false },
  { key: 'client_review', label: 'Client Review', scope: 'client' as const, needsObjective: false },
  { key: 'proposal_strategy', label: 'Proposal Strategy', scope: 'client' as const, needsObjective: false },
  { key: 'lead_qualification', label: 'Lead Qualification', scope: 'client' as const, needsObjective: false },
] as const

const MULTI_CLIENT_TEMPLATES = [
  { key: 'business_action_plan', label: 'Business Action Plan', scope: 'global' as const, needsObjective: false },
  { key: 'weekly_planning', label: 'Weekly Planning', scope: 'global' as const, needsObjective: false },
  { key: 'revenue_analysis', label: 'Revenue Analysis', scope: 'global' as const, needsObjective: false },
  { key: 'follow_up_recommendations', label: 'Follow-Up Recommendations', scope: 'global' as const, needsObjective: false },
  { key: 'business_advisor', label: 'Business Advisor', scope: 'global' as const, needsObjective: true },
] as const

export interface ClientOption {
  id: string
  name: string
}

interface ClientFilteredGeneratorProps {
  clients: ClientOption[]
  defaultAi?: string | null
}

export function ClientFilteredGenerator({ clients, defaultAi }: ClientFilteredGeneratorProps) {
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [templateKey, setTemplateKey] = useState<string>('business_action_plan')
  const [objective, setObjective] = useState('')
  const { result, loading, error, generate, clear } = usePromptGenerator()

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return clients
    return clients.filter((c) => c.name.toLowerCase().includes(q))
  }, [clients, search])

  const isSingleClient = selectedIds.size === 1
  const activeTemplates = isSingleClient ? SINGLE_CLIENT_TEMPLATES : MULTI_CLIENT_TEMPLATES
  const selectedTemplate = activeTemplates.find((t) => t.key === templateKey)

  function toggleClient(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      // Reset template when crossing the single/multi boundary
      const nowSingle = next.size === 1
      const wasSingle = prev.size === 1
      if (nowSingle !== wasSingle) {
        const defaults = nowSingle ? SINGLE_CLIENT_TEMPLATES : MULTI_CLIENT_TEMPLATES
        setTemplateKey(defaults[0].key)
        setObjective('')
      }
      return next
    })
    clear()
  }

  function selectAll() {
    setSelectedIds((prev) => {
      const next = new Set(filteredClients.map((c) => c.id))
      const nowSingle = next.size === 1
      const wasSingle = prev.size === 1
      if (nowSingle !== wasSingle) {
        const defaults = nowSingle ? SINGLE_CLIENT_TEMPLATES : MULTI_CLIENT_TEMPLATES
        setTemplateKey(defaults[0].key)
        setObjective('')
      }
      return next
    })
    clear()
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setTemplateKey(MULTI_CLIENT_TEMPLATES[0].key)
    setObjective('')
    clear()
  }

  async function handleGenerate() {
    if (selectedIds.size === 0) return
    if (selectedTemplate?.needsObjective && !objective.trim()) return
    if (isSingleClient) {
      const clientId = Array.from(selectedIds)[0]!
      await generate({
        templateKey,
        scope: 'client',
        clientId,
        objective: objective.trim() || undefined,
      })
    } else {
      await generate({
        templateKey,
        scope: 'global',
        clientIds: Array.from(selectedIds),
        objective: objective.trim() || undefined,
      })
    }
  }

  const canGenerate =
    selectedIds.size > 0 && (!selectedTemplate?.needsObjective || objective.trim())

  return (
    <div className="flex flex-col gap-4">
      {/* Template selector */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="cfg-template" className="text-xs font-medium text-muted-foreground">
          Template
        </label>
        <select
          id="cfg-template"
          value={templateKey}
          onChange={(e) => { setTemplateKey(e.target.value); setObjective(''); clear() }}
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          {activeTemplates.map((t) => (
            <option key={t.key} value={t.key}>{t.label}</option>
          ))}
        </select>
      </div>

      {/* Objective input (only for Business Advisor) */}
      {selectedTemplate?.needsObjective && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cfg-objective" className="text-xs font-medium text-muted-foreground">
            Objective
          </label>
          <div className="relative">
            <input
              id="cfg-objective"
              type="text"
              value={objective}
              onChange={(e) => { setObjective(e.target.value); if (result) clear() }}
              placeholder="e.g. Which of these clients are most likely to convert?"
              className="h-9 w-full rounded-lg border border-input bg-background px-3 pr-8 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
            {objective && (
              <button
                type="button"
                onClick={() => { setObjective(''); clear() }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                aria-label="Clear objective"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Client picker */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">
            Clients
            {selectedIds.size > 0 && (
              <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                {selectedIds.size} selected
              </span>
            )}
          </label>
          <div className="flex gap-2">
            {filteredClients.length > 0 && (
              <button
                type="button"
                onClick={selectAll}
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                Select all
              </button>
            )}
            {selectedIds.size > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients…"
            className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-sm placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
        </div>

        {/* Client list */}
        {clients.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
            <Users className="size-5 opacity-40" />
            No clients yet. Add some clients to use this feature.
          </div>
        ) : (
          <div className="max-h-52 overflow-y-auto rounded-lg border border-border divide-y divide-border">
            {filteredClients.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-muted-foreground">No clients match your search.</p>
            ) : (
              filteredClients.map((client) => {
                const selected = selectedIds.has(client.id)
                return (
                  <button
                    key={client.id}
                    type="button"
                    onClick={() => toggleClient(client.id)}
                    className={cn(
                      'flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50',
                      selected && 'bg-primary/5',
                    )}
                    aria-pressed={selected}
                  >
                    <span
                      className={cn(
                        'flex size-4 shrink-0 items-center justify-center rounded border transition-colors',
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background',
                      )}
                      aria-hidden
                    >
                      {selected && <Check className="size-3" />}
                    </span>
                    <span className="flex-1 truncate font-medium">{client.name}</span>
                  </button>
                )
              })
            )}
          </div>
        )}
      </div>

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={!canGenerate || loading}
        className="self-start gap-1.5"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Sparkles className="size-4" />
        )}
        {loading ? 'Generating…' : `Generate for ${selectedIds.size || '…'} client${selectedIds.size === 1 ? '' : 's'}`}
      </Button>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
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
        />
      )}
    </div>
  )
}
