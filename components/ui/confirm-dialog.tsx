'use client'

import { Dialog } from '@base-ui/react/dialog'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel?: string
  variant?: 'destructive' | 'default'
  onConfirm: () => void
  isPending?: boolean
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  variant = 'default',
  onConfirm,
  isPending = false,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Backdrop
          className="fixed inset-0 z-50 bg-black/30 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs"
        />
        <Dialog.Popup
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-background p-6 shadow-xl transition-all duration-200 data-ending-style:opacity-0 data-ending-style:translate-y-1 data-starting-style:opacity-0 data-starting-style:translate-y-1"
        >
          <Dialog.Title className="text-base font-semibold text-foreground">
            {title}
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground leading-relaxed">
            {description}
          </Dialog.Description>

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close
              render={
                <Button variant="outline" disabled={isPending} />
              }
            >
              Cancel
            </Dialog.Close>

            <Button
              variant={variant === 'destructive' ? 'destructive' : 'default'}
              onClick={onConfirm}
              disabled={isPending}
            >
              {isPending && <Loader2 className="animate-spin" />}
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
