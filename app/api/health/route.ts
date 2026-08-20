import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/**
 * Liveness check: can this deployment reach Supabase at all.
 *
 * Deliberately says nothing else. It used to echo the Supabase URL and, on
 * failure, `String(err)` — which is whatever the client library put in the
 * message: a hostname, a connection string fragment, a stack. None of that
 * helps whoever is legitimately checking whether the app is up, and all of it
 * helps someone mapping the deployment. The detail goes to the logs, where the
 * operator can already see it.
 */
export async function GET() {
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.getUser()

    // getUser returns an error when there is no session — that is expected
    // for an unauthenticated request. What we're confirming is that the client
    // could reach Supabase at all (network + key valid).
    const reachable = !error || error.message !== 'Failed to fetch'

    return NextResponse.json({ supabase: reachable ? 'ok' : 'unreachable' })
  } catch (err) {
    console.error('[health]', err)
    return NextResponse.json({ supabase: 'error' }, { status: 500 })
  }
}
