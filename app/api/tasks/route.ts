import { type NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/auth'
import { listTasks, createTask } from '@/lib/tasks'
import { createTaskSchema, listTasksSchema } from '@/lib/tasks/validators'

export async function GET(req: NextRequest) {
  const ownerId = await getOwnerId()
  const { searchParams } = req.nextUrl

  const raw = {
    due:       searchParams.get('due')       ?? undefined,
    projectId: searchParams.get('projectId') ?? undefined,
  }
  const parsed = listTasksSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const tasks = await listTasks(ownerId, parsed.data)
  return NextResponse.json({ tasks })
}

export async function POST(req: NextRequest) {
  const ownerId = await getOwnerId()
  const body = await req.json()
  const parsed = createTaskSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const task = await createTask(ownerId, parsed.data)
  if (!task) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
  return NextResponse.json({ task }, { status: 201 })
}
