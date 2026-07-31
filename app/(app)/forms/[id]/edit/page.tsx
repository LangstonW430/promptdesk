import { redirect, notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { getOwnerId } from '@/lib/auth'
import { getFormById } from '@/lib/forms'
import { listProjects } from '@/lib/projects'
import { FormBuilder } from '@/components/forms/form-builder'

type Params = Promise<{ id: string }>

export default async function EditFormPage({ params }: { params: Params }) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const { id } = await params
  let form
  try {
    form = await getFormById(ownerId, id)
  } catch {
    notFound()
  }

  const allProjects = await listProjects(ownerId)

  // A form keeps its project even after that project is archived, and archived
  // projects are excluded from listProjects. Without this the picker would have
  // no option matching the form's own project and would render as unselected.
  let projectOptions = allProjects
  if (!allProjects.some((p) => p.id === form.projectId)) {
    const archived = await listProjects(ownerId, { archived: true })
    const own = archived.find((p) => p.id === form.projectId)
    if (own) projectOptions = [own, ...allProjects]
  }

  const projects = projectOptions.map((p) => ({
    id: p.id,
    title: p.isArchived ? `${p.title} (archived)` : p.title,
    clientName: p.clientName,
  }))

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/forms/${id}`}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to form
      </Link>

      <div className="mt-4 flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Edit form</h1>
      </div>

      <div className="mt-6">
        <FormBuilder projectId={form.projectId} projects={projects} existing={form} />
      </div>
    </div>
  )
}
