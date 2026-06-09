import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getOwnerId } from '@/lib/auth'
import { listClients } from '@/lib/clients'
import { ProjectForm } from '@/components/projects/project-form'

type SearchParams = Promise<{ clientId?: string }>

export default async function NewProjectPage({ searchParams }: { searchParams: SearchParams }) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const { clientId } = await searchParams

  const clients = await listClients(ownerId, { archived: false })
  const clientOptions = clients.map((c) => ({
    id: c.id,
    displayName: c.companyName ?? c.contactName ?? 'Unnamed client',
  }))

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to projects
      </Link>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card p-6">
        <h1 className="mb-6 text-xl font-semibold tracking-tight">New project</h1>
        <ProjectForm clients={clientOptions} defaultClientId={clientId} />
      </div>
    </div>
  )
}
