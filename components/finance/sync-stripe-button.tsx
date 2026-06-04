'use client'

import { useTransition } from 'react'
import { RefreshCw, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { syncStripeAction } from '@/lib/actions/finance'
import { useRouter } from 'next/navigation'
import type { SerializedSyncState } from '@/lib/finance/stripe-sync'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

interface SyncStripeButtonProps {
  syncState: SerializedSyncState | null
}

export function SyncStripeButton({ syncState }: SyncStripeButtonProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const isSyncing = isPending || syncState?.status === 'syncing'
  const hasError = syncState?.status === 'error'

  function handleSync() {
    startTransition(async () => {
      const result = await syncStripeAction()
      if (!result.success) {
        // Error stored in StripeSyncState.lastError — page re-render will display it
        console.error('Stripe sync error:', result.error)
      }
      router.refresh()
    })
  }

  return (
    <div className="flex w-full flex-col gap-2">
      <p className="text-xs font-medium text-muted-foreground">Stripe sync</p>

      <Button
        variant="outline"
        size="sm"
        className="w-full"
        onClick={handleSync}
        disabled={isSyncing}
      >
        {isSyncing ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-2 size-4" />
        )}
        {isSyncing ? 'Syncing…' : 'Sync Stripe'}
      </Button>

      {/* Status line */}
      {hasError && syncState?.lastError ? (
        <p className="flex items-start gap-1 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3 shrink-0" />
          {syncState.lastError.slice(0, 80)}
        </p>
      ) : syncState?.lastBackfillAt ? (
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <CheckCircle2 className="size-3 shrink-0 text-emerald-500" />
          Last synced {relativeTime(syncState.lastBackfillAt)}
        </p>
      ) : (
        <p className="text-xs text-muted-foreground/60">
          {process.env.NEXT_PUBLIC_STRIPE_CONFIGURED === 'true'
            ? 'Never synced'
            : 'Add STRIPE_RESTRICTED_KEY to enable'}
        </p>
      )}
    </div>
  )
}
