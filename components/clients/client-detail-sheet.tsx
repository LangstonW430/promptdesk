'use client'

import { useRouter } from 'next/navigation'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import { ClientDetail, type SerializedClientDetail } from '@/components/clients/client-detail'

interface ClientDetailSheetProps {
  client: SerializedClientDetail
  defaultAi?: string | null
}

export function ClientDetailSheet({ client, defaultAi }: ClientDetailSheetProps) {
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
        style={{ maxWidth: '540px', padding: 0, gap: 0, overflowY: 'auto' }}
      >
        <ClientDetail client={client} defaultAi={defaultAi} onClose={() => router.back()} />
      </SheetContent>
    </Sheet>
  )
}
