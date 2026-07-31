import { cache } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Returns the authenticated Supabase Auth user, or null if there is no session.
 * Safe to call from Server Components and Server Actions.
 *
 * Wrapped in React `cache()` so that repeated calls within a single request —
 * layout + page, or a page that needs both the user object and the owner id —
 * share one result. `supabase.auth.getUser()` is a network round-trip to the
 * Supabase Auth server (it revalidates the JWT rather than decoding it
 * locally), so de-duplicating it removes real latency from every render.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})

/**
 * Returns the authenticated user's ID for use as owner_id in Prisma queries.
 * Throws if called outside an authenticated request — the proxy should prevent
 * unauthenticated requests from reaching app routes, so this should never throw
 * in normal operation.
 *
 * This is the authoritative auth check: the proxy only gates redirects, so
 * every data access still revalidates the session here.
 */
export const getOwnerId = cache(async (): Promise<string> => {
  const user = await getCurrentUser()
  if (!user) throw new Error('getOwnerId() called without an authenticated session')
  return user.id
})
