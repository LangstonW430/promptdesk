import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { safeNextPath } from '@/lib/safe-redirect'

// Handles the redirect back from Supabase after Google (or other) OAuth.
// Supabase appends ?code=... to this URL; we exchange it for a session.
//
// `next` is attacker-supplied and is concatenated onto `origin`, which has no
// trailing slash — so it decides the host unless something stops it. It used to
// be used verbatim: `?next=@evil.com` gave `https://app.example.com@evil.com`,
// where the part that looks like our domain is only userinfo. safeNextPath
// reduces it to a path or throws it away.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNextPath(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // Something went wrong — send to login with an error flag
  return NextResponse.redirect(`${origin}/login?error=oauth-failed`)
}
