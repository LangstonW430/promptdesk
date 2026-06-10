import { prisma } from '@/lib/db/client'
import { updateUserSettings } from '@/lib/users'
import { SAMPLE_CLIENTS } from './data'

function daysFromNow(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() + n)
  return d
}

export async function loadSampleData(ownerId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    for (const def of SAMPLE_CLIENTS) {
      const lastContactDate = daysFromNow(-def.lastContactDaysAgo)
      const nextFollowupDate = daysFromNow(def.nextFollowupDaysFromNow)

      const client = await tx.client.create({
        data: {
          ownerId,
          companyName: def.companyName,
          contactName: def.contactName,
          email: def.email,
          industry: def.industry,
          status: def.status,
          estimatedValue: def.estimatedValue,
          lastContactDate,
          nextFollowupDate,
          painPoints: def.painPoints,
          isSampleData: true,
        },
      })

      for (const tagDef of def.tags) {
        const tag = await tx.tag.upsert({
          where: { ownerId_label: { ownerId, label: tagDef.label } },
          create: { ownerId, label: tagDef.label, color: tagDef.color },
          update: {},
        })
        await tx.clientTag.create({
          data: { clientId: client.id, tagId: tag.id },
        })
      }

      for (const noteDef of def.notes) {
        const occurredAt = daysFromNow(-noteDef.daysAgo)
        const note = await tx.note.create({
          data: {
            ownerId,
            clientId: client.id,
            body: noteDef.body,
            noteType: noteDef.noteType,
            occurredAt,
          },
        })
        await tx.activity.create({
          data: {
            ownerId,
            clientId: client.id,
            type: 'note_added',
            detail: { noteId: note.id, preview: noteDef.body.slice(0, 80) },
            createdAt: occurredAt,
          },
        })
      }

      for (const projDef of def.projects ?? []) {
        const project = await tx.project.create({
          data: {
            ownerId,
            clientId:     client.id,
            title:        projDef.title,
            status:       projDef.status,
            startDate:    daysFromNow(-projDef.startDaysAgo),
            endDate:      projDef.endDaysAgo != null ? daysFromNow(-projDef.endDaysAgo) : null,
            budget:       projDef.budget,
            deliverables: projDef.deliverables,
          },
        })

        for (const te of projDef.timeEntries) {
          await tx.timeEntry.create({
            data: {
              ownerId,
              projectId:   project.id,
              date:        daysFromNow(-te.daysAgo),
              hours:       te.hours,
              rate:        te.rate,
              description: te.description,
              isBillable:  te.isBillable,
            },
          })
        }

        for (const taskDef of projDef.tasks) {
          await tx.task.create({
            data: {
              ownerId,
              projectId: project.id,
              title:     taskDef.title,
              isDone:    taskDef.isDone,
            },
          })
        }
      }
    }
  }, { timeout: 30000 })

  await updateUserSettings(ownerId, { sampleDataLoaded: true })
}

export async function clearSampleData(ownerId: string): Promise<void> {
  await prisma.client.deleteMany({ where: { ownerId, isSampleData: true } })
  await updateUserSettings(ownerId, { sampleDataLoaded: false })
}

export async function hasSampleData(ownerId: string): Promise<boolean> {
  const count = await prisma.client.count({ where: { ownerId, isSampleData: true } })
  return count > 0
}
