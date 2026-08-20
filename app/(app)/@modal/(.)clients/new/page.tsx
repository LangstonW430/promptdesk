import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ClientFormSheet } from '@/components/clients/client-form-sheet'

/**
 * `/clients/new` opened from the client list.
 *
 * This route exists because of how the sibling `(.)clients/[id]` intercept
 * matches: `new` is a perfectly good `[id]`, so a soft navigation to
 * `/clients/new` was being intercepted as a client detail, and the lookup threw
 * on a non-UUID id — the list stayed put behind a sheet reading "This client
 * couldn't load". A static segment outranks a dynamic one, so this claims the
 * URL back.
 *
 * Interception keeps the children slot on `/clients`, so this has to render the
 * create form itself rather than defer to `clients/new/page.tsx`. That page
 * still serves hard navigations and reloads.
 *
 * Carries the same session check as that page. Neither renders data, but a
 * route under (app) that no longer needs an authenticated user is the exception
 * worth stating explicitly, not the default worth leaving implicit.
 */
export default async function NewClientModal() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  return <ClientFormSheet />
}
