import { redirect } from 'next/navigation'
import { getOwnerId } from '@/lib/auth'
import { prisma } from '@/lib/db/client'
import { PromptGeneratorShell } from '@/components/prompts/prompt-generator-shell'

export default async function PromptsPage() {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { defaultAi: true },
  })

  return (
    <div className="mx-auto max-w-3xl flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Prompts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate an AI prompt from your CRM data — copy it and paste it into your
          preferred AI to get an expert-level answer about your business.
        </p>
      </div>

      <PromptGeneratorShell defaultAi={user?.defaultAi ?? null} />
    </div>
  )
}
