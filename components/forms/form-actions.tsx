'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { updateFormAction, deleteFormAction } from '@/lib/actions/forms'

interface FormActionsProps {
  formId:   string
  isActive: boolean
}

export function FormActions({ formId, isActive }: FormActionsProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function handleToggle() {
    startTransition(async () => {
      const result = await updateFormAction(formId, { isActive: !isActive })
      if ('error' in result) { setError(result.error ?? 'Failed to update'); return }
      router.refresh()
    })
  }

  function handleDelete() {
    if (!confirm('Delete this form? All submissions will be permanently removed.')) return
    startTransition(async () => {
      const result = await deleteFormAction(formId)
      if ('error' in result) { setError(result.error ?? 'Failed to delete'); return }
      router.push('/forms')
    })
  }

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-destructive">{error}</span>}
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={isPending}
        title={isActive ? 'Deactivate form' : 'Activate form'}
      >
        {isPending
          ? <Loader2 className="size-3.5 animate-spin" />
          : isActive
            ? <ToggleRight className="size-3.5 text-green-500" />
            : <ToggleLeft className="size-3.5 text-muted-foreground" />}
        {isActive ? 'Active' : 'Inactive'}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDelete}
        disabled={isPending}
        className="text-destructive hover:text-destructive hover:bg-destructive/10"
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}
