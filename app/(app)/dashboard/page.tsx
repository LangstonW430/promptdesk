import { redirect } from 'next/navigation'
import { Users, Briefcase, TrendingUp, Zap } from 'lucide-react'
import { getOwnerId } from '@/lib/auth'
import {
  getDashboardAggregates,
  getRecentActivities,
  getRecentGeneratedPrompts,
  getSavedTemplates,
} from '@/lib/dashboard'
import { getRecommendedActions } from '@/lib/daily-actions'
import { formatCurrencyCompact } from '@/lib/dashboard/format'
import { StatCard } from '@/components/dashboard/stat-card'
import { ConversionMetric } from '@/components/dashboard/conversion-metric'
import { PipelineChart } from '@/components/dashboard/pipeline-chart'
import { ActivityFeed } from '@/components/dashboard/activity-feed'
import { PromptHistory } from '@/components/dashboard/prompt-history'
import { SavedTemplates } from '@/components/dashboard/saved-templates'
import { RecommendedActions } from '@/components/dashboard/recommended-actions'

export default async function DashboardPage() {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const [aggregates, activities, recentPrompts, templates, recommendedActions] =
    await Promise.all([
      getDashboardAggregates(ownerId),
      getRecentActivities(ownerId),
      getRecentGeneratedPrompts(ownerId),
      getSavedTemplates(ownerId),
      getRecommendedActions(ownerId),
    ])

  return (
    <div className="flex flex-col gap-6">
      {/* ── Header ─────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your pipeline at a glance
        </p>
      </div>

      {/* ── Stat cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={Users}
          label="Total Leads"
          value={String(aggregates.totalLeads)}
          subtext="in your pipeline"
        />
        <StatCard
          icon={Briefcase}
          label="Active Clients"
          value={String(aggregates.activeClients)}
          subtext="contacted · proposal · negotiating"
        />
        <StatCard
          icon={TrendingUp}
          label="Pipeline Value"
          value={formatCurrencyCompact(aggregates.totalPipelineValue)}
          subtext="open stages combined"
        />
        <StatCard
          icon={Zap}
          label="Revenue Forecast"
          value={formatCurrencyCompact(aggregates.revenueForecast)}
          subtext="probability-weighted"
          highlight
        />
      </div>

      {/* ── Pipeline visualization ──────────────────────────────── */}
      <PipelineChart
        stages={aggregates.pipelineByStage}
        stageProbabilities={aggregates.stageProbabilities}
        totalPipelineValue={aggregates.totalPipelineValue}
      />

      {/* ── Bottom two-column layout ────────────────────────────── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        {/* Left: activity feed */}
        <ActivityFeed activities={activities} />

        {/* Right: stacked panels */}
        <div className="flex flex-col gap-4">
          <RecommendedActions actions={recommendedActions} />
          <ConversionMetric
            rate={aggregates.conversionRate}
            wonCount={aggregates.wonCount}
            lostCount={aggregates.lostCount}
          />
          <PromptHistory prompts={recentPrompts} />
          <SavedTemplates templates={templates} />
        </div>
      </div>
    </div>
  )
}
