import { type NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/auth'
import { deleteAttachment } from '@/lib/attachments'

type Params = Promise<{ id: string }>

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const ownerId = await getOwnerId()
  const { id } = await params
  const deleted = await deleteAttachment(ownerId, id)
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
