import { type NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { BUILT_IN_TEMPLATES } from '@/lib/prompt-engine/templates'

const TEMPLATE_NAMES = Object.fromEntries(
  BUILT_IN_TEMPLATES.map((t) => [t.key, t.name]),
)

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
function serverError(err: unknown) {
  console.error('[GET /api/prompts/history]', err)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    return unauthorized()
  }

  try {
    const savedOnly = req.nextUrl.searchParams.get('saved') === 'true'

    const rows = await prisma.generatedPrompt.findMany({
      where: { ownerId, ...(savedOnly ? { isSaved: true } : {}) },
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
    })

    const prompts = rows.map((r) => ({
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

    return NextResponse.json({ prompts })
  } catch (err) {
    return serverError(err)
  }
}
