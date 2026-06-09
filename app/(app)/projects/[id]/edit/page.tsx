import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getOwnerId } from '@/lib/auth'
import { getProjectById } from '@/lib/projects'
import { listClients } from '@/lib/clients'
import { ProjectForm } from '@/components/projects/project-form'

type Params = Promise<{ id: string }>

export default async function EditProjectPage({ params }: { params: Params }) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const { id } = await params
  const [project, clients] = await Promise.all([
    getProjectById(ownerId, id),
    listClients(ownerId, { archived: false }),
  ])

  if (!project) notFound()

  const clientOptions = clients.map((c) => ({
    id: c.id,
    displayName: c.companyName ?? c.contactName ?? 'Unnamed client',
  }))

  const serializedProject = {
    id:           project.id,
    title:        project.title,
    clientId:     project.clientId,
    status:       project.status,
    startDate:    project.startDate ? project.startDate.toISOString().slice(0, 10) : null,
    endDate:      project.endDate   ? project.endDate.toISOString().slice(0, 10)   : null,
    budget:       project.budget
      ? (typeof project.budget === 'object'
          ? (project.budget as { toNumber(): number }).toNumber()
          : Number(project.budget))
      : null,
    deliverables: (project.deliverables as string[]) ?? [],
  }

  return (
    <div className="mx-auto max-w-xl">
      <Link
        href={`/projects/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to project
      </Link>

      <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card p-6">
        <h1 className="mb-6 text-xl font-semibold tracking-tight">Edit project</h1>
        <ProjectForm clients={clientOptions} project={serializedProject} />
      </div>
    </div>
  )
}
