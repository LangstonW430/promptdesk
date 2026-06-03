import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOwnerId } from '@/lib/auth'
import { prisma } from '@/lib/db/client'

const ratingSchema = z.object({
  rating: z.union([z.literal(1), z.literal(-1), z.null()]),
})

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
  console.error('[POST /api/prompts/:id/rate]', err)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function POST(
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

    let body: unknown
    try {
      body = await req.json()
    } catch {
      return badRequest('Invalid JSON body')
    }

    const parsed = ratingSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)

    const exists = await prisma.generatedPrompt.count({ where: { id, ownerId } })
    if (!exists) return notFound()

    await prisma.generatedPrompt.update({
      where: { id },
      data: { rating: parsed.data.rating },
    })

    return NextResponse.json({ rating: parsed.data.rating })
  } catch (err) {
    return serverError(err)
  }
}
