import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScopeBadge } from '@/components/dashboard/scope-badge'
import type { RecentPrompt } from '@/lib/dashboard'
import { relativeTime, formatTemplateKey } from '@/lib/dashboard/format'

interface PromptHistoryProps {
  prompts: RecentPrompt[]
}

export function PromptHistory({ prompts }: PromptHistoryProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Recent Prompts</CardTitle>
      </CardHeader>
      <CardContent>
        {prompts.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            No prompts generated yet. Try the Prompts page.
          </p>
        ) : (
          <div className="flex flex-col">
            {prompts.map((p, i) => (
              <div
                key={p.id}
                className={`flex items-start justify-between gap-3 py-2.5 ${
                  i < prompts.length - 1 ? 'border-b border-border' : ''
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">
                    {formatTemplateKey(p.templateKey)}
                  </p>
                  <div className="mt-1 flex items-center gap-1.5">
                    <ScopeBadge scope={p.scope} />
                    {p.clientName && (
                      <span className="truncate text-xs text-muted-foreground">
                        · {p.clientName}
                      </span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {relativeTime(p.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
