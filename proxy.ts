import { createServerClient } from '@supabase/ssr'
import { type NextRequest, NextResponse } from 'next/server'
import { buildCsp } from '@/lib/security-headers'

const PUBLIC_PREFIXES = [
  '/login',
  '/signup',
  '/auth',
  '/invoice',
  // '/f' and '/api/public' served the public form-fill page and its submit
  // endpoint, and stayed listed here after both routes were removed so that
  // restoring the files would be enough to bring the feature back. That is a
  // standing invitation to ship an unauthenticated route by accident: anything
  // dropped under those paths is public before anyone reviews it. Restoring
  // Forms should re-add the prefix in the same commit as the route, where the
  // decision to make it public is visible.
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
 * server, and it is also what refreshes the session cookie, so it is skipped
 * for public routes — the landing page, the public invoice page and the
 * unauthenticated API routes never read the session, and paying for an auth
 * call before discovering that was pure waste.
 *
 * It used to be skipped for router prefetches too, on the reasoning that they
 * are speculative, fire in bursts, and are backstopped by `getOwnerId()` in
 * every page and route handler anyway. The backstop is real and still the
 * thing actually protecting the data — but the trigger was
 * `next-router-prefetch: 1`, a request header, and anyone can set a request
 * header. That made the gate opt-out for whoever knew the header name, which
 * is not a gate. The latency it was buying is not worth a check an attacker
 * can decline, particularly for a control that sits in front of everything.
 *
 * So the gate now runs for every non-public path. `getOwnerId()` stays where it
 * is: this decides whether to redirect, that decides whether data is returned,
 * and neither is trusted to be the only one.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // One nonce per request, and it has to be unpredictable — a guessable nonce
  // is an allow-list entry an injected script can write for itself.
  const nonceBytes = new Uint8Array(16)
  crypto.getRandomValues(nonceBytes)
  const nonce = btoa(String.fromCharCode(...nonceBytes))
  const csp = buildCsp(nonce, process.env.NODE_ENV === 'development')

  // Next reads the nonce back out of the CSP on the *request* and stamps it
  // onto the script tags it emits itself; `x-nonce` is what app/layout.tsx
  // reads for the one inline script we write by hand. Both have to be set here,
  // before the request reaches the renderer.
  //
  // Rebuilt from `request.headers` at each use rather than snapshotted once:
  // the Supabase cookie handler below mutates `request.cookies` and then needs
  // a response carrying those refreshed cookies, and a snapshot taken up here
  // would still hold the pre-refresh Cookie header.
  const requestWithNonce = () => {
    const headers = new Headers(request.headers)
    headers.set('x-nonce', nonce)
    headers.set('content-security-policy', csp)
    return { headers }
  }

  /** Every path out of this function returns through here. */
  const withCsp = (response: NextResponse) => {
    response.headers.set('content-security-policy', csp)
    return response
  }

  if (isPublic(pathname)) {
    return withCsp(NextResponse.next({ request: requestWithNonce() }))
  }

  let supabaseResponse = NextResponse.next({ request: requestWithNonce() })

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
          supabaseResponse = NextResponse.next({ request: requestWithNonce() })
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
    return withCsp(NextResponse.redirect(loginUrl))
  }

  return withCsp(supabaseResponse)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
