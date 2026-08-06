'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-24 text-center">
      <AlertTriangle className="size-8 text-muted-foreground/50" />
      <div>
        <p className="text-sm font-medium">This page couldn&apos;t load</p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Something went wrong loading this data. Retry, or come back in a moment.
        </p>
      </div>
      <Button size="sm" variant="outline" onClick={() => reset()}>
        Try again
      </Button>
    </div>
  )
}
