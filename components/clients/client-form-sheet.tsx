'use client'

import { useRouter } from 'next/navigation'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ClientForm } from '@/components/clients/client-form'

export function ClientFormSheet() {
  const router = useRouter()

  return (
    <Sheet
      open
      onOpenChange={(open: boolean) => {
        if (!open) router.back()
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        style={{ maxWidth: '540px', gap: 0, overflowY: 'auto' }}
      >
        <SheetHeader className="px-6 pt-6">
          <SheetTitle>New client</SheetTitle>
          <SheetDescription>Add a new lead or client to your pipeline</SheetDescription>
        </SheetHeader>
        <div className="p-6">
          <ClientForm />
        </div>
      </SheetContent>
    </Sheet>
  )
}
