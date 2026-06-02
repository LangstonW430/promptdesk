import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

/**
 * Returns the authenticated Supabase Auth user, or null if there is no session.
 * Safe to call from Server Components and Server Actions.
 */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

/**
 * Returns the authenticated user's ID for use as owner_id in Prisma queries.
 * Throws if called outside an authenticated request — middleware should prevent
 * unauthenticated requests from reaching app routes, so this should never throw
 * in normal operation.
 */
export async function getOwnerId(): Promise<string> {
  const user = await getCurrentUser()
  if (!user) throw new Error('getOwnerId() called without an authenticated session')
  return user.id
}
