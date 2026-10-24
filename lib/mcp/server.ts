import { McpServer } from '@modelcontextprotocol/server'
import { MCP_SERVER_INFO } from './config'
import { registerPrompts } from './prompts'
import { registerTools } from './tools'

/**
 * A server instance for one request, serving one account.
 *
 * ── Why `ownerId` is an argument ─────────────────────────────────────────────
 *
 * This is where the owner-scoping requirement is actually met. The SDK calls
 * the factory once per HTTP request and hands it the request's verified
 * `authInfo`; the owner is read out there and passed down here, where every
 * tool and prompt closes over it. A tool therefore has no owner argument to
 * accept and no session to consult — it cannot be made to serve the wrong
 * account without changing its signature, which is a different kind of mistake
 * from forgetting a `where` clause.
 *
 * Construction is cheap and side-effect free, which is what the SDK asks of a
 * per-request factory: registering a tool records a schema and a closure. The
 * expensive things — the Prisma pool — live at module scope in
 * `lib/db/client.ts` and are closed over, not rebuilt.
 */
export function buildMcpServer(ownerId: string): McpServer {
  const server = new McpServer(MCP_SERVER_INFO)

  registerTools(server, ownerId)
  registerPrompts(server, ownerId)

  return server
}
