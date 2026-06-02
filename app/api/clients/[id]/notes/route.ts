import { NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/auth'
import { listNotes, createNote } from '@/lib/notes'
import { createNoteSchema } from '@/lib/notes/validators'

type Params = Promise<{ id: string }>

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const ownerId = await getOwnerId()
  const { id: clientId } = await params
  const notes = await listNotes(ownerId, clientId)
  return NextResponse.json({ notes })
}

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const ownerId = await getOwnerId()
  const { id: clientId } = await params
  const body = await req.json()
  const parsed = createNoteSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }
  const note = await createNote(ownerId, clientId, parsed.data)
  if (!note) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
  return NextResponse.json({ note }, { status: 201 })
}
