import { type NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/auth'
import { listTags, createTag } from '@/lib/tags'
import { createTagSchema } from '@/lib/tags/validators'

export async function GET() {
  const ownerId = await getOwnerId()
  const tags = await listTags(ownerId)
  return NextResponse.json({ tags })
}

export async function POST(req: NextRequest) {
  const ownerId = await getOwnerId()
  const body = await req.json()
  const parsed = createTagSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  try {
    const tag = await createTag(ownerId, parsed.data)
    return NextResponse.json({ tag }, { status: 201 })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create tag'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}
