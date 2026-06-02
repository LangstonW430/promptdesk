import { redirect } from 'next/navigation'
import { getOwnerId } from '@/lib/auth'
import { listTags } from '@/lib/tags'
import { TagManager } from '@/components/settings/tag-manager'

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
    <div className="mx-auto max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your tags and workspace preferences.
        </p>
      </div>

      <TagManager initialTags={tags} />

      <div className="mt-8 rounded-xl border border-dashed border-border p-5 text-sm text-muted-foreground">
        Token budget, stage probabilities, preferred AI destination, and account details — coming in Phase 4.
      </div>
    </div>
  )
}
