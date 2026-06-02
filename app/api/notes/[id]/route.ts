import { NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/auth'
import { deleteNote } from '@/lib/notes'

type Params = Promise<{ id: string }>

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const ownerId = await getOwnerId()
  const { id } = await params
  const deleted = await deleteNote(ownerId, id)
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
