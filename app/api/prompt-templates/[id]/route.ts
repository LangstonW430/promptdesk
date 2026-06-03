import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOwnerId } from '@/lib/auth'
import { prisma } from '@/lib/db/client'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
function badRequest(msg: string) {
  return NextResponse.json({ error: msg }, { status: 400 })
}
function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
function serverError(err: unknown) {
  console.error('[PATCH /api/prompt-templates/:id]', err)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

const patchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  body: z.string().min(1).optional(),
  tokenBudget: z.number().int().positive().max(32_000).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    return unauthorized()
  }

  try {
    const { id } = await params

    let rawBody: unknown
    try {
      rawBody = await req.json()
    } catch {
      return badRequest('Invalid JSON body')
    }

    const parsed = patchSchema.safeParse(rawBody)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)

    // Verify ownership — never allow editing built-in (ownerId: null) templates
    const existing = await prisma.promptTemplate.findFirst({
      where: { id, ownerId },
      select: { version: true },
    })
    if (!existing) return notFound()

    const updated = await prisma.promptTemplate.update({
      where: { id },
      data: {
        ...(parsed.data.name !== undefined && { name: parsed.data.name }),
        ...(parsed.data.description !== undefined && { description: parsed.data.description }),
        ...(parsed.data.body !== undefined && { body: parsed.data.body }),
        ...(parsed.data.tokenBudget !== undefined && { tokenBudget: parsed.data.tokenBudget }),
        version: existing.version + 1,
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

    return NextResponse.json({
      template: { ...updated, description: updated.description ?? null, isCustom: true },
    })
  } catch (err) {
    return serverError(err)
  }
}
