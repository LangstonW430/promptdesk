'use client'

import { useState, useTransition } from 'react'
import { Pencil, Trash2, Check, X, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TAG_COLORS, type TagColor } from '@/lib/tags/validators'
import { TAG_COLOR_CLASSES, TAG_DOT_CLASSES } from '@/lib/tags/colors'
import {
  createTagAction,
  updateTagAction,
  deleteTagAction,
} from '@/lib/actions/tags'

// ── Types ──────────────────────────────────────────────────────────────────

export type SerializedTag = {
  id: string
  label: string
  color: string | null
  clientCount: number
}

// ── Main component ─────────────────────────────────────────────────────────

interface TagManagerProps {
  initialTags: SerializedTag[]
}

export function TagManager({ initialTags }: TagManagerProps) {
  const [tags, setTags] = useState<SerializedTag[]>(initialTags)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showNewForm, setShowNewForm] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleCreated(tag: SerializedTag) {
    setTags((prev) => [...prev, tag].sort((a, b) => a.label.localeCompare(b.label)))
    setShowNewForm(false)
  }

  function handleUpdated(tag: SerializedTag) {
    setTags((prev) =>
      prev
        .map((t) => (t.id === tag.id ? tag : t))
        .sort((a, b) => a.label.localeCompare(b.label)),
    )
    setEditingId(null)
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deleteTagAction(id)
      if (!('error' in result)) {
        setTags((prev) => prev.filter((t) => t.id !== id))
      }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-medium">Tags</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Categorize clients and filter your pipeline quickly.
          </p>
        </div>
        {!showNewForm && (
          <Button variant="outline" size="sm" onClick={() => setShowNewForm(true)}>
            <Plus />
            New tag
          </Button>
        )}
      </div>

      {/* New tag form */}
      {showNewForm && (
        <TagForm
          onSave={(tag) => handleCreated({ ...tag, clientCount: 0 })}
          onCancel={() => setShowNewForm(false)}
        />
      )}

      {/* Tag list */}
      {tags.length === 0 && !showNewForm ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">
          No tags yet. Create one to start categorizing clients.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border">
          {tags.map((tag) =>
            editingId === tag.id ? (
              <li key={tag.id} className="p-4">
                <TagForm
                  initial={{ label: tag.label, color: (tag.color as TagColor) ?? 'gray' }}
                  tagId={tag.id}
                  onSave={(updated) =>
                    handleUpdated({ ...tag, ...updated })
                  }
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <li
                key={tag.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                {/* Tag chip */}
                <span
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-xs font-medium',
                    TAG_COLOR_CLASSES[(tag.color ?? 'gray') as TagColor],
                  )}
                >
                  {tag.label}
                </span>

                {/* Client count */}
                {tag.clientCount > 0 && (
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {tag.clientCount} {tag.clientCount === 1 ? 'client' : 'clients'}
                  </span>
                )}

                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setEditingId(tag.id)}
                    disabled={isPending}
                    aria-label="Edit tag"
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDelete(tag.id)}
                    disabled={isPending}
                    aria-label="Delete tag"
                    className="text-muted-foreground hover:text-destructive"
                  >
                    {isPending ? <Loader2 className="animate-spin" /> : <Trash2 />}
                  </Button>
                </div>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  )
}

// ── Tag form (shared by create + edit) ─────────────────────────────────────

interface TagFormProps {
  tagId?: string
  initial?: { label: string; color: TagColor }
  onSave: (tag: { id: string; label: string; color: string }) => void
  onCancel: () => void
}

function TagForm({ tagId, initial, onSave, onCancel }: TagFormProps) {
  const [label, setLabel] = useState(initial?.label ?? '')
  const [color, setColor] = useState<TagColor>(initial?.color ?? 'gray')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const isEdit = !!tagId

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) {
      setError('Label is required')
      return
    }
    setError(null)
    startTransition(async () => {
      const result = isEdit
        ? await updateTagAction(tagId, { label: label.trim(), color })
        : await createTagAction({ label: label.trim(), color })

      if ('error' in result) {
        setError(result.error ?? 'An error occurred')
        return
      }
      const saved = 'tag' in result ? result.tag : null
      if (saved) {
        onSave({ id: saved.id, label: saved.label, color: saved.color ?? 'gray' })
      }
    })
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4"
    >
      <div className="flex items-center gap-3">
        {/* Label input */}
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Tag label"
          autoFocus
          disabled={isPending}
          className="flex-1 rounded-lg border border-input bg-background px-3 py-1.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:opacity-50"
        />

        {/* Preview chip */}
        <span
          className={cn(
            'hidden shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium sm:inline',
            TAG_COLOR_CLASSES[color],
          )}
        >
          {label || 'Preview'}
        </span>
      </div>

      {/* Color picker */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Color:</span>
        {TAG_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setColor(c)}
            aria-label={c}
            className={cn(
              'size-5 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              TAG_DOT_CLASSES[c],
              color === c && 'ring-2 ring-offset-1 ring-foreground/30 scale-110',
            )}
          />
        ))}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? <Loader2 className="animate-spin" /> : <Check />}
          {isEdit ? 'Save' : 'Create tag'}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={isPending}>
          <X />
          Cancel
        </Button>
      </div>
    </form>
  )
}
