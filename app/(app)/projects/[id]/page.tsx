import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getOwnerId } from '@/lib/auth'
import { getProjectById } from '@/lib/projects'
import { listTimeEntries } from '@/lib/time-entries'
import { prisma } from '@/lib/db/client'
import { ProjectDetail } from '@/components/projects/project-detail'

type Params = Promise<{ id: string }>

export default async function ProjectDetailPage({ params }: { params: Params }) {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const { id } = await params
  const [project, timeEntries] = await Promise.all([
    getProjectById(ownerId, id),
    listTimeEntries(ownerId, { projectId: id }),
  ])

  if (!project) notFound()

  const client = await prisma.client.findFirst({
    where: { id: project.clientId, ownerId },
    select: { companyName: true, contactName: true, defaultRate: true },
  })
  if (!client) notFound()

  const clientName = client.companyName ?? client.contactName ?? 'Unknown client'
  const defaultRate = client.defaultRate
    ? (typeof client.defaultRate === 'object'
        ? (client.defaultRate as { toNumber(): number }).toNumber()
        : Number(client.defaultRate))
    : null

  const serializedProject = {
    id:           project.id,
    title:        project.title,
    status:       project.status,
    startDate:    project.startDate ? project.startDate.toISOString().slice(0, 10) : null,
    endDate:      project.endDate   ? project.endDate.toISOString().slice(0, 10)   : null,
    budget:       project.budget
      ? (typeof project.budget === 'object'
          ? (project.budget as { toNumber(): number }).toNumber()
          : Number(project.budget))
      : null,
    deliverables: (project.deliverables as string[]) ?? [],
    clientId:     project.clientId,
    clientName,
    defaultRate,
    isArchived:   project.isArchived,
    tasks:        project.tasks.map((t) => ({
      id:      t.id,
      title:   t.title,
      isDone:  t.isDone,
      dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
    })),
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/projects"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronLeft className="size-4" />
        Back to projects
      </Link>

      <div className="mt-4">
        <ProjectDetail project={serializedProject} timeEntries={timeEntries} />
      </div>
    </div>
  )
}
