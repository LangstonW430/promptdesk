'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import * as Sentry from '@sentry/nextjs'
import { AlertTriangle } from 'lucide-react'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'

export default function ClientModalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <Sheet open onOpenChange={(open: boolean) => { if (!open) router.back() }}>
      <SheetContent side="right" showCloseButton={false} style={{ maxWidth: '540px' }}>
        <div className="flex flex-col items-center gap-3 px-6 py-24 text-center">
          <AlertTriangle className="size-8 text-muted-foreground/50" />
          <div>
            <p className="text-sm font-medium">This client couldn&apos;t load</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Something went wrong loading this record. Retry, or close and try again.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => router.back()}>
              Close
            </Button>
            <Button size="sm" onClick={() => reset()}>
              Try again
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
