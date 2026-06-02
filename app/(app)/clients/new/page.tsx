import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { ClientForm } from '@/components/clients/client-form'

export default function NewClientPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href="/clients"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
          Back to clients
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">New client</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add a new lead or client to your pipeline
        </p>
      </div>

      <ClientForm />
    </div>
  )
}
