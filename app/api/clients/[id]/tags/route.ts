import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getOwnerId } from '@/lib/auth'
import { attachTag, detachTag } from '@/lib/tags'

const bodySchema = z.object({ tagId: z.string().uuid() })

type Params = Promise<{ id: string }>

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const ownerId = await getOwnerId()
  const { id: clientId } = await params
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const result = await attachTag(ownerId, clientId, parsed.data.tagId)
  if (!result) return NextResponse.json({ error: 'Client or tag not found' }, { status: 404 })
  return NextResponse.json({ success: true }, { status: 201 })
}

export async function DELETE(req: NextRequest, { params }: { params: Params }) {
  const ownerId = await getOwnerId()
  const { id: clientId } = await params
  const parsed = bodySchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  await detachTag(ownerId, clientId, parsed.data.tagId)
  return new NextResponse(null, { status: 204 })
}
