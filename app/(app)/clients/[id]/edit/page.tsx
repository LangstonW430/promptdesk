import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getOwnerId } from '@/lib/auth'
import { getClientById } from '@/lib/clients'
import { ClientForm } from '@/components/clients/client-form'

type Params = Promise<{ id: string }>

export default async function EditClientPage({ params }: { params: Params }) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const { id } = await params
  const client = await getClientById(ownerId, id)
  if (!client) notFound()

  const forEdit = {
    id: client.id,
    companyName: client.companyName,
    contactName: client.contactName,
    email: client.email,
    phone: client.phone,
    website: client.website,
    industry: client.industry,
    companySize: client.companySize,
    leadSource: client.leadSource,
    status: client.status,
    estimatedValue: client.estimatedValue ? Number(client.estimatedValue) : null,
    projectType: client.projectType,
    painPoints: client.painPoints,
    requirements: client.requirements,
    opportunityNotes: client.opportunityNotes,
    lastContactDate: client.lastContactDate?.toISOString() ?? null,
    nextFollowupDate: client.nextFollowupDate?.toISOString() ?? null,
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href={`/clients/${id}`}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" />
          Back to client
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          Edit {client.companyName ?? client.contactName ?? 'client'}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Update contact information and pipeline details
        </p>
      </div>

      <ClientForm client={forEdit} />
    </div>
  )
}
