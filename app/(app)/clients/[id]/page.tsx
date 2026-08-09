import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getOwnerId } from '@/lib/auth'
import { getClientById } from '@/lib/clients'
import { clientStagesFor } from '@/lib/clients/stage-query'
import { serializeClientDetail } from '@/lib/clients/serialize'
import { ClientDetail } from '@/components/clients/client-detail'
import { prisma } from '@/lib/db/client'

type Params = Promise<{ id: string }>

export default async function ClientDetailPage({ params }: { params: Params }) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const { id } = await params
  const [client, user, stages] = await Promise.all([
    getClientById(ownerId, id),
    prisma.user.findUnique({ where: { id: ownerId }, select: { defaultAi: true } }),
    clientStagesFor(ownerId, [id]),
  ])
  if (!client) notFound()

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/clients"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to clients
      </Link>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
        <ClientDetail
          client={serializeClientDetail(client, stages.get(id) ?? 'lead')}
          defaultAi={user?.defaultAi ?? null}
        />
      </div>
    </div>
  )
}
