import { Skeleton } from '@/components/ui/skeleton'

function QueueSkeleton() {
  return (
    <section className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <Skeleton className="size-4 rounded-full" />
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-5 w-6 rounded-full" />
      </div>
      <Skeleton className="h-4 w-72" />

      {/* Client rows */}
      <div className="overflow-hidden rounded-xl border border-border">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border last:border-0 px-4 py-3"
          >
            <div className="flex flex-col gap-1.5 flex-1 min-w-0">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-7 w-20 shrink-0" />
            <Skeleton className="h-7 w-24 shrink-0" />
          </div>
        ))}
      </div>
    </section>
  )
}

export default function DailyActionsLoading() {
  return (
    <div className="flex flex-col gap-8">
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <Skeleton className="h-7 w-36" />
        <Skeleton className="h-4 w-52" />
      </div>

      <QueueSkeleton />
      <QueueSkeleton />
      <QueueSkeleton />
    </div>
  )
}
