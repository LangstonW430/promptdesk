import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus } from 'lucide-react'
import { getOwnerId } from '@/lib/auth'
import { listProjects } from '@/lib/projects'
import { ProjectList } from '@/components/projects/project-list'
import { buttonVariants } from '@/components/ui/button'

export default async function ProjectsPage() {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const projects = await listProjects(ownerId)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Track active work, progress, and time by project
          </p>
        </div>
        <Link href="/projects/new" className={buttonVariants()}>
          <Plus className="size-4" />
          New project
        </Link>
      </div>

      <ProjectList projects={projects} />
    </div>
  )
}
