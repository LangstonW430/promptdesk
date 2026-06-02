import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/signup', '/auth/callback']

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
}

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  // Create a Supabase client that can read and write the session cookie.
  // The response is mutated here so Set-Cookie headers are forwarded.
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
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getUser() is the authoritative check — it validates the JWT with Supabase.
  // getSession() alone cannot be trusted server-side.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Unauthenticated user trying to reach a protected page
  if (!user && !isPublicPath(pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Authenticated user hitting an auth page — send them into the app
  if (user && isPublicPath(pathname)) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Run on all paths except:
     *   - _next/static  (static files)
     *   - _next/image   (image optimisation)
     *   - favicon.ico
     *   - api routes (they authenticate themselves)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/).*)',
  ],
}
