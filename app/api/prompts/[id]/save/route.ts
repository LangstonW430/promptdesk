import { type NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/auth'
import { prisma } from '@/lib/db/client'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}
function serverError(err: unknown) {
  console.error('[POST /api/prompts/:id/save]', err)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function POST(
  _req: NextRequest,
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

    const existing = await prisma.generatedPrompt.findFirst({
      where: { id, ownerId },
      select: { isSaved: true },
    })
    if (!existing) return notFound()

    const updated = await prisma.generatedPrompt.update({
      where: { id },
      data: { isSaved: !existing.isSaved },
      select: { isSaved: true },
    })

    return NextResponse.json({ isSaved: updated.isSaved })
  } catch (err) {
    return serverError(err)
  }
}
