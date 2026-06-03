import { redirect } from 'next/navigation'
import { getOwnerId } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { BUILT_IN_TEMPLATES } from '@/lib/prompt-engine/templates'
import { PromptsPageTabs } from '@/components/prompts/prompts-page-tabs'
import type { HistoryItem } from '@/components/prompts/prompt-history-list'
import type { TemplateItem } from '@/components/prompts/template-browser'

const TEMPLATE_NAMES = Object.fromEntries(
  BUILT_IN_TEMPLATES.map((t) => [t.key, t.name]),
)

export default async function PromptsPage() {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const [user, historyRows, userTemplates] = await Promise.all([
    prisma.user.findUnique({
      where: { id: ownerId },
      select: { defaultAi: true },
    }),
    prisma.generatedPrompt.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        templateKey: true,
        scope: true,
        clientId: true,
        renderedText: true,
        tokenCount: true,
        isSaved: true,
        rating: true,
        createdAt: true,
        client: { select: { companyName: true, contactName: true } },
      },
    }),
    prisma.promptTemplate.findMany({
      where: { ownerId, isActive: true },
      select: {
        id: true,
        key: true,
        name: true,
        description: true,
        scope: true,
        version: true,
        tokenBudget: true,
        body: true,
      },
      orderBy: { name: 'asc' },
    }),
  ])

  // ── Serialise history ────────────────────────────────────────────────────────
  const history: HistoryItem[] = historyRows.map((r) => ({
    id: r.id,
    templateKey: r.templateKey,
    templateName: TEMPLATE_NAMES[r.templateKey] ?? r.templateKey.replace(/_/g, ' '),
    scope: r.scope,
    clientId: r.clientId,
    clientName: r.client
      ? (r.client.companyName ?? r.client.contactName ?? null)
      : null,
    renderedText: r.renderedText,
    tokenCount: r.tokenCount,
    isSaved: r.isSaved,
    rating: r.rating as 1 | -1 | null,
    createdAt: r.createdAt.toISOString(),
  }))

  // ── Build template list: custom copies + un-overridden built-ins ─────────────
  const userKeys = new Set(userTemplates.map((t) => t.key))
  const builtInItems: TemplateItem[] = BUILT_IN_TEMPLATES.filter(
    (t) => !userKeys.has(t.key),
  ).map((t) => ({
    id: null,
    key: t.key,
    name: t.name,
    description: t.description,
    scope: t.scope,
    version: t.version,
    tokenBudget: t.tokenBudget,
    body: t.body,
    isCustom: false,
  }))

  const customItems: TemplateItem[] = userTemplates.map((t) => ({
    id: t.id,
    key: t.key,
    name: t.name,
    description: t.description ?? null,
    scope: t.scope,
    version: t.version,
    tokenBudget: t.tokenBudget,
    body: t.body,
    isCustom: true,
  }))

  const templates: TemplateItem[] = [...customItems, ...builtInItems]

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Prompts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate AI prompts from your CRM data, review history, and manage templates.
        </p>
      </div>

      <PromptsPageTabs
        defaultAi={user?.defaultAi ?? null}
        initialHistory={history}
        initialTemplates={templates}
      />
    </div>
  )
}
