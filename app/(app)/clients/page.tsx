import { redirect } from 'next/navigation'
import { getOwnerId } from '@/lib/auth'
import { listClientsForTable } from '@/lib/clients'
import { ClientTable } from '@/components/clients/client-table'
import type { ClientStatus } from '@/lib/clients/types'

type SearchParams = Promise<{
  q?: string
  status?: string
  tag?: string
  stale?: string
  archived?: string
}>

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const params = await searchParams

  const rawClients = await listClientsForTable(ownerId, {
    q: params.q,
    status: params.status as ClientStatus | undefined,
    tag: params.tag,
    stale: params.stale ? Number(params.stale) : undefined,
    archived: params.archived === 'true',
  })

  // Serialize Prisma Decimals and Dates before passing to the client component
  const clients = rawClients.map((c) => ({
    id: c.id,
    companyName: c.companyName,
    contactName: c.contactName,
    email: c.email,
    industry: c.industry,
    status: c.status,
    pipelineValue: c.pipelineValue,
    lastContactDate: c.lastContactDate?.toISOString() ?? null,
    nextFollowupDate: c.nextFollowupDate?.toISOString() ?? null,
    clientTags: c.clientTags.map((ct) => ({
      tag: { id: ct.tag.id, label: ct.tag.label },
    })),
  }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your pipeline and contacts
        </p>
      </div>
      <ClientTable clients={clients} />
    </div>
  )
}
