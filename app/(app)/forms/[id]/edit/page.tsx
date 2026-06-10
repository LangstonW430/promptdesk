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
  const projects = allProjects.map((p) => ({ id: p.id, title: p.title, clientName: p.clientName }))

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
