import { redirect } from 'next/navigation'
import { getOwnerId } from '@/lib/auth'
import { getClientById } from '@/lib/clients'
import { serializeClientDetail } from '@/lib/clients/serialize'
import { ClientDetailSheet } from '@/components/clients/client-detail-sheet'
import { prisma } from '@/lib/db/client'

type Params = Promise<{ id: string }>

export default async function ClientDetailModal({ params }: { params: Params }) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const { id } = await params
  const [client, user] = await Promise.all([
    getClientById(ownerId, id),
    prisma.user.findUnique({ where: { id: ownerId }, select: { defaultAi: true } }),
  ])
  if (!client) redirect('/clients')

  return (
    <ClientDetailSheet
      client={serializeClientDetail(client)}
      defaultAi={user?.defaultAi ?? null}
    />
  )
}
