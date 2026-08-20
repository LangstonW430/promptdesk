'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/safe-redirect'
import { clientIp, rateLimit } from '@/lib/rate-limit'

const signInSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

const signUpSchema = z.object({
  email: z.email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

/**
 * Nothing stood between an attacker and an unlimited number of password
 * guesses. Two counters rather than one, because either alone leaves a gap: by
 * address alone, a botnet gets a full allowance per host; by email alone, an
 * attacker spraying one common password across many accounts never trips it.
 *
 * The message is deliberately the same whichever counter fired, and says
 * nothing about whether the account exists.
 */
const TOO_MANY = {
  error: 'Too many attempts. Wait a minute and try again.',
} as const

async function attemptAllowed(bucket: string, email: string): Promise<boolean> {
  const ip = clientIp(await headers())
  const byIp = rateLimit(`${bucket}:ip`, ip, { limit: 10, windowMs: 60_000 })
  const byEmail = rateLimit(`${bucket}:email`, email.toLowerCase(), {
    limit: 5,
    windowMs: 60_000,
  })
  return byIp.ok && byEmail.ok
}

export async function signIn(_: unknown, formData: FormData) {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  if (!(await attemptAllowed('sign-in', parsed.data.email))) return TOO_MANY

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) return { error: error.message }

  // `startsWith('/')` was the whole check here, and `//evil.com` passes it —
  // a protocol-relative URL keeps our scheme and swaps the host. See
  // lib/safe-redirect.ts.
  redirect(safeNextPath(formData.get('next')))
}

export async function signUp(_: unknown, formData: FormData) {
  const parsed = signUpSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  // Also the throttle on using signup to enumerate which emails are registered.
  if (!(await attemptAllowed('sign-up', parsed.data.email))) return TOO_MANY

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) return { error: error.message }

  // If the user has a session immediately they were auto-confirmed; otherwise
  // they need to confirm their email before signing in.
  if (data.session) {
    redirect('/dashboard')
  }

  redirect('/login?message=check-email')
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
