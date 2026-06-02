import { type NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/auth'
import { setClientArchived } from '@/lib/clients'
import { archiveClientSchema } from '@/lib/clients/validators'

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

/** POST /api/clients/:id/archive — body: { archived: boolean } */
export async function POST(req: NextRequest, ctx: RouteContext) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    return unauthorized()
  }

  try {
    const { id } = await ctx.params
    const body = await req.json()
    const parsed = archiveClientSchema.safeParse(body)
    if (!parsed.success) return badRequest(parsed.error.issues[0].message)

    const client = await setClientArchived(ownerId, id, parsed.data.archived)
    if (!client) return notFound()
    return NextResponse.json({ client })
  } catch (err) {
    return serverError(err)
  }
}
