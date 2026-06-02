import { type NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/auth'
import { saveAttachmentMetadata } from '@/lib/attachments'
import { confirmUploadSchema } from '@/lib/attachments/validators'

type Params = Promise<{ id: string }>

export async function POST(req: NextRequest, { params }: { params: Params }) {
  const ownerId = await getOwnerId()
  const { id: clientId } = await params

  const parsed = confirmUploadSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })
  }

  const attachment = await saveAttachmentMetadata(ownerId, clientId, parsed.data)
  if (!attachment) {
    return NextResponse.json({ error: 'Client not found or unauthorized' }, { status: 404 })
  }
  return NextResponse.json({ attachment }, { status: 201 })
}
