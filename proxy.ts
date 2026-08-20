import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'

const PUBLIC_PREFIXES = [
  '/login',
  '/signup',
  '/auth',
  '/invoice',
  // '/f' and '/api/public' served the public form-fill page and its submit
  // endpoint. Both routes are removed while Forms is shelved; the prefixes are
  // kept so restoring those files is all that is needed to bring the feature
  // back. Nothing is reachable under them in the meantime.
  '/f',
  '/api/public',
  '/api/invoice',
  // Stripe posts here with no session and no cookies, so the gate below would
  // redirect every delivery to /login and the handler would never run — which
  // is what was happening: invoice status and payment updates only ever
  // arrived when somebody pressed "Refresh from Stripe" by hand.
  //
  // Being public costs nothing. The handler trusts nothing until it has
  // verified the Stripe signature against that owner's stored secret, and the
  // token in the path only selects which secret to check against.
  '/api/webhooks',
]

function isPublic(pathname: string): boolean {
  if (pathname === '/') return true
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + '/'),
  )
}

/**
 * Session gate.
 *
 * `supabase.auth.getUser()` is a network round-trip to the Supabase Auth
 * server, and it is also what refreshes the session cookie — so it stays on
 * the path that needs it (real navigations to protected routes) and is skipped
 * on the two paths that provably do not:
 *
 *   1. Public routes. The landing page, public invoice/form pages and the
 *      unauthenticated API routes never read the session, so paying for an
 *      auth call before discovering that was pure waste.
 *   2. Router prefetches. These are speculative and fire in bursts (every
 *      sidebar link entering the viewport), competing with the navigation the
 *      user actually clicked. Skipping the gate here does not expose anything:
 *      every protected page and route handler calls `getOwnerId()`, which
 *      revalidates the session itself and throws without one. A prefetch that
 *      slips past this gate renders an error, not data. The subsequent real
 *      navigation still runs the full check and refreshes the cookie.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (isPublic(pathname)) {
    return NextResponse.next({ request })
  }

  if (request.headers.get('next-router-prefetch') === '1') {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // Refreshes the session cookie as a side effect of validating the token.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
