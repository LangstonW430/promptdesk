import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Auth middleware — runs on every request that isn't a static asset.
 *
 * Responsibilities:
 * 1. Refresh the Supabase session (required by @supabase/ssr so the auth
 *    cookie stays fresh across RSC + Server Actions).
 * 2. Redirect unauthenticated users away from protected routes.
 * 3. Redirect authenticated users away from auth pages (/login, /signup).
 */
export async function middleware(request: NextRequest) {
  // We must create a response object upfront so the cookie setters can mutate it.
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write updated cookies onto the request (for downstream handlers)
          // and onto the response (for the browser).
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: always use getUser() not getSession() — getUser() validates
  // the token server-side, getSession() only reads the local cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  const isAuthRoute =
    pathname.startsWith('/login') ||
    pathname.startsWith('/signup') ||
    pathname.startsWith('/auth/')

  // Unauthenticated → redirect to login (preserve destination in `next` param)
  if (!user && !isAuthRoute) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/login'
    loginUrl.searchParams.set('next', pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Authenticated user hitting auth pages → send to the app
  if (user && (pathname === '/login' || pathname === '/signup')) {
    const next = request.nextUrl.searchParams.get('next') ?? '/dashboard'
    const dest = request.nextUrl.clone()
    dest.pathname = next
    dest.searchParams.delete('next')
    return NextResponse.redirect(dest)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match every path except:
     * - Next.js internals (_next/static, _next/image)
     * - Static files (favicon.ico, images, fonts)
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)',
  ],
}
