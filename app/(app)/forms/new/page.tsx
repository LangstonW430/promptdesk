import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import { getOwnerId } from '@/lib/auth'
import { listProjects } from '@/lib/projects'
import { FormBuilder } from '@/components/forms/form-builder'

type SearchParams = Promise<{ projectId?: string }>

export default async function NewFormPage({ searchParams }: { searchParams: SearchParams }) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const { projectId } = await searchParams
  const allProjects = await listProjects(ownerId)

  if (allProjects.length === 0) {
    redirect('/projects')
  }

  const defaultProjectId = projectId ?? allProjects[0].id

  const projects = allProjects.map((p) => ({
    id:         p.id,
    title:      p.title,
    clientName: p.clientName,
  }))

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href="/forms"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to forms
      </Link>

      <div className="mt-4 flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">New form</h1>
        <p className="text-sm text-muted-foreground">Build a form and share the link with your client.</p>
      </div>

      <div className="mt-6">
        <FormBuilder projectId={defaultProjectId} projects={projects} />
      </div>
    </div>
  )
}
