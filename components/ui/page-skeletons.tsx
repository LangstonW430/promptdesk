import { Skeleton } from '@/components/ui/skeleton'

/**
 * Shared loading shells for the form and detail routes.
 *
 * These exist so every route has a `loading.tsx`: in the App Router a `<Link>`
 * prefetch for a dynamic route only fills the cache down to the nearest
 * loading boundary, so a route without one cannot be prefetched at all and
 * the click becomes a cold round-trip with no visual feedback.
 */

export function FormPageSkeleton({ fields = 6 }: { fields?: number }) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-7 w-56" />
      </div>

      <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-6">
        {Array.from({ length: fields }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="h-3.5 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}

        <div className="flex justify-end gap-2 pt-2">
          <Skeleton className="h-9 w-20" />
          <Skeleton className="h-9 w-28" />
        </div>
      </div>
    </div>
  )
}

export function DetailPageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Skeleton className="h-4 w-28" />

      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
          >
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="h-7 w-24" />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <Skeleton className="h-5 w-36" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </div>
  )
}
