'use client'

import { useState } from 'react'
import { CreditCard, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

type Props = {
  publicToken: string
  total: number
}

export function PublicPayButton({ publicToken, total }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePay() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/invoice/${publicToken}/checkout`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Unable to start payment. Please try again.')
        setLoading(false)
        return
      }
      // Redirect to Stripe Checkout — loading stays true until navigation
      window.location.href = data.url
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(total)

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        size="lg"
        className="gap-2 min-w-48"
        disabled={loading}
        onClick={handlePay}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CreditCard className="size-4" />
        )}
        {loading ? 'Redirecting…' : `Pay ${formatted}`}
      </Button>
      {error && (
        <p className="text-sm text-destructive text-center max-w-xs">{error}</p>
      )}
    </div>
  )
}
