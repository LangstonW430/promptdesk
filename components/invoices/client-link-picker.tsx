'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Link2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { linkInvoiceToClientAction } from '@/lib/actions/invoices'

export type ClientOption = { id: string; name: string }

/**
 * Attaches an imported invoice to a CRM client by hand.
 *
 * The escape hatch for what automatic matching cannot know — someone billed at
 * a personal address, or who simply was not in the CRM when the invoice was
 * raised. Linking also back-fills the client's Stripe customer id, so their
 * next invoice matches on its own.
 */
export function ClientLinkPicker({
  invoiceId,
  clients,
}: {
  invoiceId: string
  clients: ClientOption[]
}) {
  const router = useRouter()
  const [isPending, start] = useTransition()
  const [clientId, setClientId] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (clients.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        You have no clients to link this to yet.
      </p>
    )
  }

  function handleLink() {
    if (!clientId) return
    setError(null)
    start(async () => {
      const res = await linkInvoiceToClientAction(invoiceId, { clientId })
      if (!res.success) {
        setError(res.error)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <Select
        value={clientId}
        onChange={(e) => setClientId(e.target.value)}
        aria-label="Client to link this invoice to"
        disabled={isPending}
      >
        <option value="">— Select a client —</option>
        {clients.map((c) => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </Select>

      <Button
        variant="outline"
        size="sm"
        className="justify-start gap-2"
        disabled={!clientId || isPending}
        onClick={handleLink}
      >
        {isPending ? <Loader2 className="size-4 animate-spin" /> : <Link2 className="size-4" />}
        Link to client
      </Button>

      {error && (
        <p className="flex items-start gap-1.5 text-xs text-destructive">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}
