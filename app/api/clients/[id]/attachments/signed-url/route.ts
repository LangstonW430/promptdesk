import { type NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/auth'
import { requestSignedUploadUrl } from '@/lib/attachments'
import { requestSignedUrlSchema } from '@/lib/attachments/validators'

type Params = Promise<{ id: string }>

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const ownerId = await getOwnerId()
  const { id: clientId } = await params

  const parsed = requestSignedUrlSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  try {
    const result = await requestSignedUploadUrl(ownerId, clientId, parsed.data)
    if (!result) return NextResponse.json({ error: 'Client not found' }, { status: 404 })
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create upload URL'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
