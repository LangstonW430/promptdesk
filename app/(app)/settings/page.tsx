import { redirect } from 'next/navigation'
import { getOwnerId } from '@/lib/auth'
import { listTags } from '@/lib/tags'
import { prisma } from '@/lib/db/client'
import { TagManager } from '@/components/settings/tag-manager'
import { CsvImporter } from '@/components/settings/csv-importer'
import { AccountSettingsForm } from '@/components/settings/account-settings-form'
import { PromptSettingsForm } from '@/components/settings/forecast-settings-form'
import type { UserSettings } from '@/lib/users'

export default async function SettingsPage() {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const [rawTags, user] = await Promise.all([
    listTags(ownerId),
    prisma.user.findUnique({
      where: { id: ownerId },
      select: {
        email: true,
        fullName: true,
        businessName: true,
        businessType: true,
        defaultAi: true,
        settings: true,
      },
    }),
  ])

  const tags = rawTags.map((t) => ({
    id: t.id,
    label: t.label,
    color: t.color,
    clientCount: t._count.clientTags,
  }))

  const settings = (user?.settings ?? {}) as UserSettings
  const tokenBudget = settings.tokenBudget ?? 4000

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your workspace preferences.
        </p>
      </div>

      <AccountSettingsForm
        email={user?.email ?? ''}
        fullName={user?.fullName ?? null}
        businessName={user?.businessName ?? null}
        businessType={user?.businessType ?? null}
        defaultAi={user?.defaultAi ?? null}
      />

      <div className="border-t border-border pt-8">
        <PromptSettingsForm tokenBudget={tokenBudget} />
      </div>

      <div className="border-t border-border pt-8">
        <TagManager initialTags={tags} />
      </div>

      <div className="border-t border-border pt-8">
        <CsvImporter />
      </div>
    </div>
  )
}
