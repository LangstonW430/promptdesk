import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Plus, Archive } from 'lucide-react'
import { getOwnerId } from '@/lib/auth'
import { listProjects } from '@/lib/projects'
import { ProjectList } from '@/components/projects/project-list'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SearchParams = Promise<{ archived?: string }>

export default async function ProjectsPage({
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
  const archived = params.archived === 'true'

  const projects = await listProjects(ownerId, { archived })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {archived
              ? 'Archived projects — restore one to make it active again'
              : 'Track active work, progress, and time by project'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={archived ? '/projects' : '/projects?archived=true'}
            aria-pressed={archived}
            className={cn(
              buttonVariants({ variant: archived ? 'secondary' : 'outline' }),
              'gap-1.5',
            )}
          >
            <Archive className="size-4" />
            {archived ? 'Active' : 'Archived'}
          </Link>
          {!archived && (
            <Link href="/projects/new" className={buttonVariants()}>
              <Plus className="size-4" />
              New project
            </Link>
          )}
        </div>
      </div>

      <ProjectList projects={projects} archived={archived} />
    </div>
  )
}
