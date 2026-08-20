import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { getCurrentUser } from '@/lib/auth'
import { ClientForm } from '@/components/clients/client-form'

/**
 * The form renders no data of its own, so this check is not what keeps anything
 * secret — the create action calls `getOwnerId()` and would refuse anyway. It
 * is here because every other page under (app) carries it, and "this one is
 * only a form" is a property of today's markup, not of the route.
 */
export default async function NewClientPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

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
