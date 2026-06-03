import { cn } from '@/lib/utils'

const STYLES: Record<string, string> = {
  global: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
  client: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  notes: 'bg-violet-50 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400',
}

export function ScopeBadge({ scope }: { scope: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-xs font-medium',
        STYLES[scope] ?? STYLES.global,
      )}
    >
      {scope}
    </span>
  )
}
