import { Skeleton } from '@/components/ui/skeleton'

export default function InvoicesLoading() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Invoice table */}
      <div className="overflow-hidden rounded-xl border border-border">
        <div className="border-b border-border bg-muted/40 px-4 py-2.5 flex gap-4">
          {[80, 128, 96, 80, 80].map((w, i) => (
            <Skeleton key={i} className="h-3.5" style={{ width: w }} />
          ))}
        </div>

        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-border last:border-0 px-4 py-3"
          >
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-4 w-20 ml-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}
