import { redirect } from 'next/navigation'
import { getOwnerId } from '@/lib/auth'
import { listTags } from '@/lib/tags'
import { TagManager } from '@/components/settings/tag-manager'
import { CsvImporter } from '@/components/settings/csv-importer'

export default async function SettingsPage() {
  let ownerId: string
  try {
    ownerId = await getOwnerId()
  } catch {
    redirect('/login')
  }

  const rawTags = await listTags(ownerId)
  const tags = rawTags.map((t) => ({
    id: t.id,
    label: t.label,
    color: t.color,
    clientCount: t._count.clientTags,
  }))

  return (
    <div className="mx-auto max-w-2xl flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your workspace preferences.
        </p>
      </div>

      <TagManager initialTags={tags} />

      <div className="border-t border-border pt-8">
        <CsvImporter />
      </div>

      <div className="rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        Token budget, stage probabilities, preferred AI destination, and account details — coming in Phase 4.
      </div>
    </div>
  )
}
