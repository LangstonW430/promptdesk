import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOwnerId } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { BUILT_IN_TEMPLATES } from '@/lib/prompt-engine/templates'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 })
}
function serverError(err: unknown) {
  console.error('[prompt-templates]', err)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

function serializeTemplate(
  t: {
    id: string
    key: string
    name: string
    description: string | null
    scope: string
    version: number
    tokenBudget: number
    body: string
  },
  isCustom: boolean,
) {
  return {
    id: t.id,
    key: t.key,
    name: t.name,
    description: t.description ?? null,
    scope: t.scope,
    version: t.version,
    tokenBudget: t.tokenBudget,
    body: t.body,
    isCustom,
  }
}

// ─── GET /api/prompt-templates ────────────────────────────────────────────────

export async function GET() {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    return unauthorized()
  }

  try {
    const userTemplates = await prisma.promptTemplate.findMany({
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
    })

    const userKeys = new Set(userTemplates.map((t) => t.key))

    // Built-ins the user has not yet customised
    const builtIns = BUILT_IN_TEMPLATES.filter((t) => !userKeys.has(t.key)).map(
      (t) => ({
        id: null as string | null,
        key: t.key,
        name: t.name,
        description: t.description,
        scope: t.scope,
        version: t.version,
        tokenBudget: t.tokenBudget,
        body: t.body,
        isCustom: false,
      }),
    )

    const custom = userTemplates.map((t) => serializeTemplate(t, true))

    return NextResponse.json({ templates: [...custom, ...builtIns] })
  } catch (err) {
    return serverError(err)
  }
}

// ─── POST /api/prompt-templates (copy-on-write) ───────────────────────────────

const createSchema = z.object({
  key: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  body: z.string().min(1),
  tokenBudget: z.number().int().positive().max(32_000).optional(),
})

export async function POST(req: NextRequest) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    return unauthorized()
  }

  try {
    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return badRequest('Invalid JSON body')
    }

    const parsed = createSchema.safeParse(rawBody)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)

    const { key, name, description, body, tokenBudget } = parsed.data

    // Check for existing user copy — update it (bumping version) instead of creating a dupe
    const existingCustom = await prisma.promptTemplate.findFirst({
      where: { key, ownerId, isActive: true },
    })

    if (existingCustom) {
      const updated = await prisma.promptTemplate.update({
        where: { id: existingCustom.id },
        data: {
          name,
          ...(description !== undefined && { description }),
          body,
          ...(tokenBudget !== undefined && { tokenBudget }),
          version: existingCustom.version + 1,
        },
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
      })
      return NextResponse.json({ template: serializeTemplate(updated, true) })
    }

    // First fork: base version on the built-in
    const builtIn = BUILT_IN_TEMPLATES.find((t) => t.key === key)
    const created = await prisma.promptTemplate.create({
      data: {
        ownerId,
        key,
        name,
        description: description ?? builtIn?.description ?? null,
        body,
        scope: builtIn?.scope ?? 'global',
        tokenBudget: tokenBudget ?? builtIn?.tokenBudget ?? 4000,
        version: (builtIn?.version ?? 1) + 1,
        isActive: true,
      },
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
    })

    return NextResponse.json({ template: serializeTemplate(created, true) }, { status: 201 })
  } catch (err) {
    return serverError(err)
  }
}
