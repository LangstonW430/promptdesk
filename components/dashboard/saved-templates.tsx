import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScopeBadge } from '@/components/dashboard/scope-badge'
import type { SavedTemplate } from '@/lib/dashboard'

interface SavedTemplatesProps {
  templates: SavedTemplate[]
}

export function SavedTemplates({ templates }: SavedTemplatesProps) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Saved Templates</CardTitle>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <p className="py-2 text-xs text-muted-foreground">
            No templates available yet.
          </p>
        ) : (
          <div className="flex flex-col">
            {templates.map((t, i) => (
              <div
                key={t.id}
                className={`py-2.5 ${i < templates.length - 1 ? 'border-b border-border' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-xs font-medium">{t.name}</p>
                  <ScopeBadge scope={t.scope} />
                </div>
                {t.description && (
                  <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                    {t.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
