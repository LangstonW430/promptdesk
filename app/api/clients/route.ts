import { type NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/auth'
import { listClients, createClient } from '@/lib/clients'
import { createClientSchema, listClientSchema } from '@/lib/clients/validators'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

function serverError(err: unknown) {
  console.error(err)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

export async function GET(req: NextRequest) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    return unauthorized()
  }

  try {
    const { searchParams } = req.nextUrl
    const raw = {
      status: searchParams.get('status') ?? undefined,
      q: searchParams.get('q') ?? undefined,
      tag: searchParams.get('tag') ?? undefined,
      stale: searchParams.get('stale') ?? undefined,
      archived: searchParams.get('archived') ?? undefined,
    }

    const parsed = listClientSchema.safeParse(raw)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)

    const clients = await listClients(ownerId, parsed.data)
    return NextResponse.json({ clients })
  } catch (err) {
    return serverError(err)
  }
}

export async function POST(req: NextRequest) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    return unauthorized()
  }

  try {
    const body = await req.json()
    const parsed = createClientSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)

    const client = await createClient(ownerId, parsed.data)
    return NextResponse.json({ client }, { status: 201 })
  } catch (err) {
    return serverError(err)
  }
}
