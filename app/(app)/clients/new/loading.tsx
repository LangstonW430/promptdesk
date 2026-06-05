import { Skeleton } from '@/components/ui/skeleton'

export default function NewClientLoading() {
  return (
    <div className="mx-auto max-w-2xl">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-3 h-7 w-32" />
      <Skeleton className="mt-1 h-4 w-56" />

      <div className="mt-8 flex flex-col gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <Skeleton className="mt-2 h-10 w-28" />
      </div>
    </div>
  )
}
