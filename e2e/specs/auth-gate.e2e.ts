import { describe, expect, it } from 'vitest'
import { appUrl, createUser, db, request, supabaseUrl } from '../harness/context'
import { sessionCookie, sessionCookieName } from '../harness/session'

/**
 * Who gets in.
 *
 * The gate is in two places and both are exercised here. The proxy redirects
 * anything without a session, and every route independently calls
 * `getOwnerId()`, which revalidates the session against the Auth server rather
 * than trusting the cookie. The second is the one that decides whether data is
 * handed over; the first only decides where a browser lands.
 */
describe('the session gate', () => {
  it('redirects an unauthenticated page request to login, remembering where it was going', async () => {
    const res = await request('/clients')

    expect(res.status).toBe(307)
    const location = new URL(res.headers.get('location')!, appUrl)
    expect(location.pathname).toBe('/login')
    expect(location.searchParams.get('next')).toBe('/clients')
  })

  /**
   * An API route is gated by the same redirect as a page, so an unauthenticated
   * XHR gets a 307 towards an HTML login page rather than the 401 its handler
   * would have returned. Pinned as it stands: the request is refused either
   * way, and the redirect is what the proxy is written to do.
   */
  it('redirects an unauthenticated API request too, rather than 401ing it', async () => {
    const res = await request('/api/clients')

    expect(res.status).toBe(307)
    expect(res.headers.get('location')).toBe('/login?next=%2Fapi%2Fclients')
  })

  it('lets a signed-in user through', async () => {
    const user = await createUser()

    const res = await request('/api/clients', { as: user })

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ clients: [] })
  })

  it('leaves public routes open', async () => {
    expect((await request('/login')).status).toBe(200)
    expect((await request('/')).status).toBe(200)
  })

  /**
   * The proxy tries to skip the auth round-trip for router prefetches, on the
   * grounds that the route behind it checks anyway. It cannot: Next strips
   * every flight header — `next-router-prefetch` among them — before middleware
   * runs, so the check never sees one and the branch is inert.
   *
   * What is asserted here is the part that matters and holds either way: a
   * request claiming to be a prefetch gets no data. If Next ever starts
   * forwarding the header, the branch comes alive and this test is what
   * confirms it still refuses.
   */
  it('gives a request claiming to be a prefetch nothing', async () => {
    const res = await request('/api/clients', {
      headers: { 'next-router-prefetch': '1', RSC: '1' },
    })

    expect(res.status).not.toBe(200)
  })

  it('treats an expired session as signed out', async () => {
    const user = await createUser()
    const expired = sessionCookie(supabaseUrl, user.id, user.email, { expiresIn: -60 })

    const res = await request('/api/clients', { headers: { cookie: expired } })

    expect(res.status).toBe(307)
  })

  /**
   * Deleting the user leaves a cookie that still parses and has not expired.
   * Only asking the Auth server catches it — which is exactly why `getOwnerId()`
   * pays for `getUser()` on every request instead of decoding the JWT.
   */
  it('treats a session for a deleted user as signed out', async () => {
    const user = await createUser()
    expect((await request('/api/clients', { as: user })).status).toBe(200)

    await db.query('DELETE FROM auth.users WHERE id = $1', [user.id])

    expect((await request('/api/clients', { as: user })).status).toBe(307)
  })

  it('ignores a cookie that is not a session', async () => {
    const name = sessionCookieName(supabaseUrl)

    const res = await request('/api/clients', {
      headers: { cookie: `${name}=base64-bm90LWEtc2Vzc2lvbg` },
    })

    expect(res.status).toBe(307)
  })
})
