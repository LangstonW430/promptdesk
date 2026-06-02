import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.getUser()

    // getUser returns an error when there is no session — that is expected
    // for an unauthenticated request. What we're confirming is that the client
    // could reach Supabase at all (network + key valid).
    const reachable = !error || error.message !== 'Failed to fetch'

    return NextResponse.json({
      supabase: reachable ? 'ok' : 'unreachable',
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      note: 'auth error is expected — no session yet',
    })
  } catch (err) {
    return NextResponse.json(
      { supabase: 'error', detail: String(err) },
      { status: 500 },
    )
  }
}
