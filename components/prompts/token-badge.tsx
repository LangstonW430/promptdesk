import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'

interface TokenBadgeProps {
  count: number
  className?: string
}

export function TokenBadge({ count, className }: TokenBadgeProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          className={cn(
            'inline-flex cursor-default items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground select-none',
            className,
          )}
        >
          ~{count.toLocaleString()} tokens
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Approximate token count (≈ chars ÷ 4). All major AI models support this length.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
