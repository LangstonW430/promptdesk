import Link from 'next/link'
import { redirect, notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getOwnerId } from '@/lib/auth'
import { getProjectById } from '@/lib/projects'
import { listTimeEntries } from '@/lib/time-entries'
import { projectFinancials } from '@/lib/projects/financials'
import { listProjectAttachments } from '@/lib/attachments'
import { prisma } from '@/lib/db/client'
import { ProjectDetail } from '@/components/projects/project-detail'

type Params = Promise<{ id: string }>

/** Prisma Decimals arrive as objects; every money column needs the same unwrap. */
function toNum(v: unknown): number | null {
  if (v == null) return null
  return typeof v === 'object' ? (v as { toNumber(): number }).toNumber() : Number(v)
}

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

  const budget = toNum(project.budget)

  const [client, financials, attachments] = await Promise.all([
    prisma.client.findFirst({
      where: { id: project.clientId, ownerId },
      select: { companyName: true, contactName: true },
    }),
    projectFinancials(ownerId, id, budget),
    listProjectAttachments(ownerId, id),
  ])
  if (!client) notFound()

  const clientName = client.companyName ?? client.contactName ?? 'Unknown client'

  const serializedProject = {
    id:           project.id,
    title:        project.title,
    status:       project.status,
    startDate:    project.startDate ? project.startDate.toISOString().slice(0, 10) : null,
    endDate:      project.endDate   ? project.endDate.toISOString().slice(0, 10)   : null,
    budget,
    deliverables: (project.deliverables as string[]) ?? [],
    clientId:     project.clientId,
    clientName,
    // The rate lives on the project now: two engagements with the same client
    // can bill differently, and the timer should offer this one's number.
    rate:         toNum(project.rate),
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
        <ProjectDetail
          project={serializedProject}
          timeEntries={timeEntries}
          financials={financials}
          attachments={attachments}
        />
      </div>
    </div>
  )
}
