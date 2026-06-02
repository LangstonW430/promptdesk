import { type NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/auth'
import { updateTask, deleteTask } from '@/lib/tasks'
import { updateTaskSchema } from '@/lib/tasks/validators'

type Params = Promise<{ id: string }>

export async function PATCH(req: NextRequest, { params }: { params: Params }) {
  const ownerId = await getOwnerId()
  const { id } = await params
  const body = await req.json()
  const parsed = updateTaskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const task = await updateTask(ownerId, id, parsed.data)
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ task })
}

export async function DELETE(_req: NextRequest, { params }: { params: Params }) {
  const ownerId = await getOwnerId()
  const { id } = await params
  const deleted = await deleteTask(ownerId, id)
  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return new NextResponse(null, { status: 204 })
}
