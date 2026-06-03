'use client'

import { useState, useTransition, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import type { TemplateItem } from './template-browser'

interface TemplateEditorSheetProps {
  template: TemplateItem | null
  onClose: () => void
  onSave: (updated: TemplateItem) => void
}

export function TemplateEditorSheet({ template, onClose, onSave }: TemplateEditorSheetProps) {
  const [name, setName] = useState(template?.name ?? '')
  const [body, setBody] = useState(template?.body ?? '')
  const [tokenBudget, setTokenBudget] = useState(String(template?.tokenBudget ?? 4000))
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Sync fields when template prop changes (different template opened)
  useEffect(() => {
    if (template) {
      setName(template.name)
      setBody(template.body)
      setTokenBudget(String(template.tokenBudget))
      setError(null)
    }
  }, [template?.key, template?.isCustom]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSave() {
    if (!template) return
    setError(null)

    const budget = parseInt(tokenBudget, 10)
    if (isNaN(budget) || budget < 100 || budget > 32_000) {
      setError('Token budget must be between 100 and 32,000.')
      return
    }

    startTransition(async () => {
      let res: Response

      if (template.isCustom && template.id) {
        res = await fetch(`/api/prompt-templates/${template.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, body, tokenBudget: budget }),
        })
      } else {
        res = await fetch('/api/prompt-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: template.key, name, body, tokenBudget: budget }),
        })
      }

      const data = await res.json()
      if (!res.ok) {
        setError((data as { error?: string }).error ?? 'Save failed')
        return
      }
      onSave(data.template as TemplateItem)
    })
  }

  const isBuiltIn = !template?.isCustom

  return (
    <Sheet open={template !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-[36rem]">
        <SheetHeader className="border-b border-border p-4">
          <SheetTitle>{isBuiltIn ? 'Customize Template' : 'Edit Template'}</SheetTitle>
          <SheetDescription>
            {isBuiltIn
              ? 'Creates your own copy. Your version will be used instead of the built-in.'
              : `v${template?.version} — saving will bump the version.`}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tmpl-name" className="text-sm font-medium">Name</label>
            <Input
              id="tmpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My custom template"
            />
          </div>

          {/* Token budget */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tmpl-budget" className="text-sm font-medium">Token budget</label>
            <Input
              id="tmpl-budget"
              type="number"
              min={100}
              max={32000}
              value={tokenBudget}
              onChange={(e) => setTokenBudget(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Controls how much CRM data is included. Most models support 4,000–8,000.
            </p>
          </div>

          {/* Body */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="tmpl-body" className="text-sm font-medium">Template body</label>
              <span className="text-xs text-muted-foreground">
                Available placeholders: {'{{business_name}} {{business_type}} {{today}} {{context_block}} {{objective}}'}
              </span>
            </div>
            <Textarea
              id="tmpl-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={18}
              className="resize-y font-mono text-xs leading-relaxed"
              placeholder="You are an expert business advisor…"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}
        </div>

        <SheetFooter className="border-t border-border p-4">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || !name.trim() || !body.trim()}>
            {isPending
              ? 'Saving…'
              : isBuiltIn
                ? 'Save as custom'
                : 'Save changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
