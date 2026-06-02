import { type NextRequest, NextResponse } from 'next/server'
import { getOwnerId } from '@/lib/auth'
import { getSignedDownloadUrl } from '@/lib/attachments'

type Params = Promise<{ id: string }>

export async function GET(_req: NextRequest, { params }: { params: Params }) {
  const ownerId = await getOwnerId()
  const { id } = await params

  try {
    const signedUrl = await getSignedDownloadUrl(ownerId, id)
    if (!signedUrl) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 })
    }
    return NextResponse.redirect(signedUrl, 302)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to generate download URL'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
