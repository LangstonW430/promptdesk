import { createMcpHandler } from '@modelcontextprotocol/server'
import { resolveMcpOwner } from '@/lib/mcp/auth'
import { buildMcpServer } from '@/lib/mcp/server'

/**
 * The MCP endpoint: Streamable HTTP, stateless, bearer-token authenticated.
 *
 * ── Runtime ──────────────────────────────────────────────────────────────────
 *
 * No `export const runtime` here. Node is the default for route handlers, and
 * `node_modules/next/dist/docs` says the Edge runtime is deprecated and to
 * remove the export from route files — so pinning it would be writing down a
 * deprecated opinion. Node is nonetheless required rather than preferred:
 * `lib/db/client.ts` builds a `pg.Pool` and a `PrismaPg` driver adapter at
 * module scope, neither of which runs on edge. If a future change makes edge
 * the default, this route needs the pin back.
 *
 * `maxDuration` matches `/api/prompts/generate` because a `prompts/get` runs
 * the same retrieval, scoring and budgeting pipeline that forced 30 seconds
 * onto that route. It also bounds the `after()` write in `lib/mcp/auth.ts`.
 */
export const maxDuration = 30

/**
 * Auth is the caller's job, by design: the handler is explicit that it never
 * reads credentials from headers itself and performs no verification. So the
 * token is resolved first, and `authInfo` is handed in as pass-through data.
 *
 * One handler at module scope, one `McpServer` per request. The factory is
 * where the per-account instance is built — see `lib/mcp/server.ts` for why
 * that placement is what makes the tools owner-scoped.
 */
const handler = createMcpHandler(
  (ctx) => {
    const ownerId = ctx.authInfo?.extra?.ownerId
    if (typeof ownerId !== 'string') {
      // Unreachable: `serve` below only calls `fetch` after a successful
      // resolve, and that is the only caller. Checked anyway, because the
      // alternative to throwing here would be constructing a server with no
      // owner, and every tool on it would then be a cross-account read.
      throw new Error('MCP server constructed without a resolved owner.')
    }
    return buildMcpServer(ownerId)
  },
  {
    onerror: (error) => {
      // Reporting only — it never alters the response. Logged with the same
      // bracketed tag the other route handlers use.
      console.error('[api/mcp]', error)
    },
  },
)

/**
 * 401 with the challenge RFC 6750 asks for.
 *
 * `WWW-Authenticate` is what tells a client this is an auth failure it could
 * fix rather than a server fault. Phase 2 adds a `resource_metadata` parameter
 * here pointing at the protected-resource document, which is how an OAuth
 * client discovers where to get a token.
 */
function unauthorized(message: string): Response {
  return Response.json(
    { error: message },
    {
      status: 401,
      headers: { 'www-authenticate': 'Bearer realm="mcp", error="invalid_token"' },
    },
  )
}

function tooManyRequests(message: string, retryAfterSeconds: number): Response {
  return Response.json(
    { error: message },
    { status: 429, headers: { 'retry-after': String(retryAfterSeconds) } },
  )
}

async function serve(request: Request): Promise<Response> {
  const auth = await resolveMcpOwner(request)

  if (!auth.ok) {
    return auth.status === 429
      ? tooManyRequests(auth.message, auth.retryAfterSeconds ?? 60)
      : unauthorized(auth.message)
  }

  return handler.fetch(request, {
    authInfo: {
      // The protocol's own fields are placeholders in this phase: there is no
      // OAuth client and no scopes, and a personal access token stands for
      // "full read access to this account". `extra` is the SDK's documented
      // channel for a server's own per-principal data, which is where the
      // thing we actually resolved goes.
      //
      // `token` is deliberately empty rather than the presented credential.
      // Nothing downstream needs it, and a bearer token placed on an object
      // that is handed to every tool is a bearer token one `console.log` or
      // one Sentry breadcrumb away from being written down. There is no
      // upside to carrying it, so it is not carried.
      token: '',
      clientId: 'mcp-personal-access-token',
      scopes: [],
      extra: { ownerId: auth.ownerId },
    },
  })
}

export { serve as POST, serve as GET, serve as DELETE }
