export default function TimeLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-9 w-24 animate-pulse rounded-lg bg-muted" />
      <div className="h-10 w-full animate-pulse rounded-xl bg-muted" />
      <div className="h-64 w-full animate-pulse rounded-xl bg-muted" />
    </div>
  )
}
