import { type NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/auth'
import { updateTag, deleteTag } from '@/lib/tags'
import { updateTagSchema } from '@/lib/tags/validators'

type Params = Promise<{ id: string }>

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const ownerId = await getOwnerId()
  const { id } = await params
  const body = await req.json()
  const parsed = updateTagSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  try {
    const tag = await updateTag(ownerId, id, parsed.data)
    if (!tag) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    return NextResponse.json({ tag })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update tag'
    return NextResponse.json({ error: message }, { status: 409 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const ownerId = await getOwnerId()
  const { id } = await params
  const deleted = await deleteTag(ownerId, id)
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
