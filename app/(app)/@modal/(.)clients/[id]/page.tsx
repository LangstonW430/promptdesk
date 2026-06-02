import { redirect } from 'next/navigation'
import { getOwnerId } from '@/lib/auth'
import { getClientById } from '@/lib/clients'
import { serializeClientDetail } from '@/lib/clients/serialize'
import { ClientDetailSheet } from '@/components/clients/client-detail-sheet'

type Params = Promise<{ id: string }>

export default async function ClientDetailModal({ params }: { params: Params }) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const { id } = await params
  const client = await getClientById(ownerId, id)
  if (!client) redirect('/clients')

  return <ClientDetailSheet client={serializeClientDetail(client)} />
}
