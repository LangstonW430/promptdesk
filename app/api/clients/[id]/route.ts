import { type NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/auth'
import { getClientById, updateClient, deleteClient } from '@/lib/clients'
import { updateClientSchema } from '@/lib/clients/validators'

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

function serverError(err: unknown) {
  console.error(err)
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, ctx: RouteContext) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    return unauthorized()
  }

  try {
    const { id } = await ctx.params
    const client = await getClientById(ownerId, id)
    if (!client) return notFound()
    return NextResponse.json({ client })
  } catch (err) {
    return serverError(err)
  }
}

export async function PATCH(req: NextRequest, ctx: RouteContext) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    return unauthorized()
  }

  try {
    const { id } = await ctx.params
    const body = await req.json()
    const parsed = updateClientSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)

    const client = await updateClient(ownerId, id, parsed.data)
    if (!client) return notFound()
    return NextResponse.json({ client })
  } catch (err) {
    return serverError(err)
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    return unauthorized()
  }

  try {
    const { id } = await ctx.params
    const deleted = await deleteClient(ownerId, id)
    if (!deleted) return notFound()
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return serverError(err)
  }
}
