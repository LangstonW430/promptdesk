'use client'

import { useState } from 'react'
import { Sparkles, Loader2, AlertCircle, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PromptResultPanel } from './prompt-result-panel'
import { BusinessAdvisorGenerator } from './business-advisor-generator'
import { usePromptGenerator } from '@/lib/prompts/use-prompt-generator'
import { cn } from '@/lib/utils'
import type { GenerateResult } from '@/lib/prompts/types'

// ─── Shared helper ────────────────────────────────────────────────────────────

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      {message}
    </div>
  )
}

// ─── Business Action Plan hero ────────────────────────────────────────────────

function BusinessActionPlanHero({ defaultAi }: { defaultAi?: string | null }) {
  const { result, loading, error, generate } = usePromptGenerator()

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h2 className="text-base font-semibold">Business Action Plan</h2>
          <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
            A comprehensive prompt covering your full pipeline — Executive Summary,
            Priority Opportunities, Daily Actions, 7-day Weekly Plan, Revenue Growth
            Opportunities, Risk Assessment, and Suggested Outreach Messages.
          </p>
        </div>
        <Button
          size="default"
          onClick={() => generate({ templateKey: 'business_action_plan', scope: 'global' })}
          disabled={loading}
          className="shrink-0 gap-1.5"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {loading ? 'Generating…' : 'Generate Prompt'}
        </Button>
      </div>

      {error && <ErrorBanner message={error} />}
      {result && (
        <PromptResultPanel
          text={result.text}
          tokenCount={result.tokenCount}
          contextMeta={result.contextMeta}
          defaultAi={defaultAi}
        />
      )}
    </section>
  )
}

// ─── Business Advisor section ─────────────────────────────────────────────────

function BusinessAdvisorSection({ defaultAi }: { defaultAi?: string | null }) {
  const [open, setOpen] = useState(false)

  return (
    <section className="rounded-xl border border-border overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between bg-card px-5 py-4 text-left transition-colors hover:bg-muted/40"
      >
        <div>
          <p className="text-sm font-semibold">Business Advisor</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Ask a specific question about your pipeline and get a focused, data-driven answer.
          </p>
        </div>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            open && 'rotate-180',
          )}
        />
      </button>
      <div
        className={cn(
          'grid transition-all duration-200 ease-in-out',
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-border bg-card px-5 py-4">
            <BusinessAdvisorGenerator defaultAi={defaultAi} />
          </div>
        </div>
      </div>
    </section>
  )
}

// ─── Secondary generator card ─────────────────────────────────────────────────

interface SecondaryCardProps {
  title: string
  description: string
  templateKey: string
  defaultAi?: string | null
}

function SecondaryCard({ title, description, templateKey, defaultAi }: SecondaryCardProps) {
  const { result, loading, error, generate } = usePromptGenerator()

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => generate({ templateKey, scope: 'global' })}
        disabled={loading}
        className="self-start gap-1.5"
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Sparkles className="size-3.5" />
        )}
        Generate
      </Button>
      {error && <ErrorBanner message={error} />}
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

// ─── Shell ────────────────────────────────────────────────────────────────────

interface PromptGeneratorShellProps {
  defaultAi?: string | null
}

export function PromptGeneratorShell({ defaultAi }: PromptGeneratorShellProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* 1. Primary: Business Action Plan */}
      <BusinessActionPlanHero defaultAi={defaultAi} />

      {/* 2. Business Advisor (collapsible) */}
      <BusinessAdvisorSection defaultAi={defaultAi} />

      {/* 3. Secondary generators */}
      <div className="grid gap-3 sm:grid-cols-2">
        <SecondaryCard
          title="Weekly Planning"
          description="Build a focused, realistic week around your highest-value deals and due tasks."
          templateKey="weekly_planning"
          defaultAi={defaultAi}
        />
        <SecondaryCard
          title="Revenue Analysis"
          description="Pipeline value breakdown, weighted forecast, and top revenue opportunities."
          templateKey="revenue_analysis"
          defaultAi={defaultAi}
        />
        <SecondaryCard
          title="Follow-Up Recommendations"
          description="See exactly who to contact and get personalised outreach drafts."
          templateKey="follow_up_recommendations"
          defaultAi={defaultAi}
        />
        <SecondaryCard
          title="Lead Qualification"
          description="BANT analysis, fit score, risk factors, and qualifying questions — global view."
          templateKey="weekly_planning"
          defaultAi={defaultAi}
        />
      </div>
    </div>
  )
}
