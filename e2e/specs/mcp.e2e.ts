import { beforeEach, describe, expect, it } from 'vitest'
import {
  appUrl,
  createUser,
  db,
  request,
  revokeSeededMcpToken,
  seedBuiltInTemplates,
  seedMcpToken,
  seedProject,
  seedTransaction,
  type TestUser,
} from '../harness/context'
import { MCP_SERVER_INFO } from '@/lib/mcp/config'

/**
 * The MCP server, through the door a real client comes in by.
 *
 * The unit tests under `__tests__/lib/mcp/` cover the pieces with Prisma
 * mocked, which proves the checks are written. These prove they are reached:
 * a real HTTP request, a real token row, a real database behind it, and the
 * session gate in `proxy.ts` in front of it.
 *
 * That gate is the reason this file exists at all. `/api/mcp` had to be added
 * to `PUBLIC_PREFIXES` or every call would be answered with a redirect to
 * /login — so the first test asserts a 401 and explicitly *not* a redirect.
 * It is the deliberate inverse of `auth-gate.e2e.ts`, which asserts that
 * every other API path does redirect.
 */

// ── JSON-RPC over Streamable HTTP ────────────────────────────────────────────

let nextId = 1

/**
 * One MCP call.
 *
 * Two details that are easy to get wrong and fail identically either way:
 *
 * The `Accept` header must offer both `application/json` and
 * `text/event-stream`. Without both the transport answers 406 before any
 * handler runs.
 *
 * The response may be a JSON body *or* a single SSE frame — the handler
 * answers with JSON and upgrades to a stream only when a notification is
 * emitted before the result, which is not something to pin a test on. So the
 * body is parsed either way rather than assuming one shape. The harness's own
 * `request()` is not used here because its `JSON.parse` would yield undefined
 * for the SSE case.
 */
async function rpc(
  token: string | null,
  method: string,
  params?: Record<string, unknown>,
) {
  const res = await fetch(`${appUrl}/api/mcp`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: nextId++,
      method,
      ...(params ? { params } : {}),
    }),
  })

  const text = await res.text()
  return { status: res.status, headers: res.headers, text, body: parseBody(text) }
}

function parseBody(text: string): Record<string, unknown> | undefined {
  try {
    return JSON.parse(text)
  } catch {
    // An SSE frame: one or more `data:` lines carrying the JSON payload.
    const data = text
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('')
    if (!data) return undefined
    try {
      return JSON.parse(data)
    } catch {
      return undefined
    }
  }
}

/** Calls a tool and returns its parsed `structuredContent`, or the error text. */
async function callTool(token: string, name: string, args: Record<string, unknown> = {}) {
  const res = await rpc(token, 'tools/call', { name, arguments: args })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = (res.body as any)?.result
  return {
    raw: res,
    isError: result?.isError === true,
    data: result?.structuredContent,
    text: res.text,
  }
}

// ── Authentication ───────────────────────────────────────────────────────────

describe('mcp authentication', () => {
  let user: TestUser
  let token: string

  beforeEach(async () => {
    user = await createUser()
    token = await seedMcpToken(user.id)
  })

  /**
   * The assertion that proves the `proxy.ts` change landed. If the session
   * gate ever swallows this path again, the symptom is a 307 to an HTML login
   * page arriving where a client expected JSON — which is exactly the failure
   * the Stripe webhook endpoint had.
   */
  it('answers an unauthenticated call with 401, not a redirect to login', async () => {
    const res = await rpc(null, 'initialize')

    expect(res.status).toBe(401)
    expect(res.status).not.toBe(307)
    expect(res.headers.get('www-authenticate')).toContain('Bearer')
    expect(res.text).not.toContain('<html')
  })

  it('rejects an unknown token', async () => {
    const res = await rpc('pd_live_' + 'A'.repeat(43), 'initialize')

    expect(res.status).toBe(401)
  })

  it('rejects a malformed token', async () => {
    expect((await rpc('nonsense', 'initialize')).status).toBe(401)
  })

  it('rejects a revoked token', async () => {
    await revokeSeededMcpToken(token)

    expect((await rpc(token, 'initialize')).status).toBe(401)
  })

  /**
   * A session cookie is not an MCP credential. Anyone logged into the app in a
   * browser must not thereby be able to drive the MCP endpoint.
   */
  it('rejects a valid session cookie with no bearer token', async () => {
    const res = await fetch(`${appUrl}/api/mcp`, {
      method: 'POST',
      redirect: 'manual',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        cookie: user.cookie,
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize' }),
    })

    expect(res.status).toBe(401)
  })

  it('accepts a valid token and names itself from the one config constant', async () => {
    const res = await rpc(token, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'e2e', version: '0' },
    })

    expect(res.status).toBe(200)
    // Pins requirement 2: a product name hardcoded into the handshake fails here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((res.body as any).result.serverInfo.name).toBe(MCP_SERVER_INFO.name)
  })

  it('records that the token was used', async () => {
    const before = await db.query('SELECT last_used_at FROM mcp_tokens')
    expect(before.rows[0].last_used_at).toBeNull()

    await rpc(token, 'tools/list')

    // Written with `after()`, so it lands once the response is sent.
    await expect
      .poll(async () => {
        const { rows } = await db.query('SELECT last_used_at FROM mcp_tokens')
        return rows[0].last_used_at !== null
      })
      .toBe(true)
  })
})

// ── Tools and prompts ────────────────────────────────────────────────────────

describe('mcp tools', () => {
  let user: TestUser
  let token: string
  let clientId: string
  let projectId: string

  beforeEach(async () => {
    await seedBuiltInTemplates()
    user = await createUser()
    token = await seedMcpToken(user.id)

    const created = await request('/api/clients', {
      as: user,
      method: 'POST',
      body: { companyName: 'Northwind Traders', email: 'ada@northwind.test' },
    })
    clientId = created.body.client.id
    projectId = await seedProject(user.id, clientId)

    await request('/api/tasks', {
      as: user,
      method: 'POST',
      body: { projectId, title: 'Send the proposal' },
    })
  })

  it('advertises exactly the read-only tools, and none that take an owner id', async () => {
    const res = await rpc(token, 'tools/list')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tools = (res.body as any).result.tools as Array<{ name: string }>

    expect(tools.map((t) => t.name).sort()).toEqual([
      'get_client_financials',
      'get_client_summary',
      'list_tasks',
      'search_clients',
    ])
    // Requirement: no tool may accept a userId argument. One line, and it
    // would catch a schema that grew one by accident.
    expect(JSON.stringify(tools)).not.toMatch(/owner_?id|user_?id/i)
  })

  it('finds a client by name', async () => {
    const { data } = await callTool(token, 'search_clients', { q: 'Northwind' })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((data as any).clients).toHaveLength(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((data as any).clients[0].name).toBe('Northwind Traders')
  })

  it('summarises a client, with the stage derived from their projects', async () => {
    const { data } = await callTool(token, 'get_client_summary', { clientId })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((data as any).name).toBe('Northwind Traders')
    // A seeded project defaults to 'active', which derives to the active stage.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((data as any).stage).toBe('active')
  })

  it('reports a clear error for a client that does not exist', async () => {
    const result = await callTool(token, 'get_client_summary', {
      clientId: '3f1b8c4e-0000-4000-8000-000000000000',
    })

    expect(result.isError).toBe(true)
    // A raw Prisma error would reach the model as noise it cannot act on.
    expect(result.text.toLowerCase()).not.toContain('prisma')
  })

  /**
   * The filter most likely to be subtly wrong: a task has no `clientId`, so it
   * has to reach through the project.
   */
  it('lists a client’s tasks through the project relation', async () => {
    const { data } = await callTool(token, 'list_tasks', { clientId })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tasks = (data as any).tasks
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('Send the proposal')
    expect(tasks[0].clientName).toBe('Northwind Traders')
    expect(tasks[0].projectId).toBe(projectId)
  })

  it('refuses the contradictory combination of finished and overdue', async () => {
    const result = await callTool(token, 'list_tasks', {
      status: 'done',
      due: 'overdue',
    })

    expect(result.isError).toBe(true)
  })

  it('reports financials with money attributed to the client', async () => {
    await seedTransaction(user.id, { clientId, projectId, amount: 4200 })

    const { data } = await callTool(token, 'get_client_financials', { clientId })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((data as any).totals.income).toBe(4200)
  })
})

describe('mcp prompts', () => {
  let user: TestUser
  let token: string
  let clientId: string

  beforeEach(async () => {
    await seedBuiltInTemplates()
    user = await createUser()
    token = await seedMcpToken(user.id)

    const created = await request('/api/clients', {
      as: user,
      method: 'POST',
      body: { companyName: 'Northwind Traders', contactName: 'Ada Bell' },
    })
    clientId = created.body.client.id
    await request(`/api/clients/${clientId}/notes`, {
      as: user,
      method: 'POST',
      body: { body: 'They want the migration finished before their audit.' },
    })
  })

  it('advertises every built-in template except the one it cannot render', async () => {
    const res = await rpc(token, 'prompts/list')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const names = ((res.body as any).result.prompts as Array<{ name: string }>).map(
      (p) => p.name,
    )

    expect(names).toContain('business_advisor')
    expect(names).toContain('client_review')
    // Needs invoice `extras` the pipeline has no way to supply.
    expect(names).not.toContain('invoice_cover_email')
  })

  it('renders a prompt from what is actually in the account', async () => {
    const res = await rpc(token, 'prompts/get', {
      name: 'client_review',
      arguments: { clientId },
    })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const text = (res.body as any).result.messages[0].content.text
    expect(text).toContain('Northwind Traders')
    expect(text).toContain('audit')
  })

  /**
   * The prompt history row is written, and marked so it can be told apart from
   * one the user generated on the Prompts page.
   */
  it('records the prompt in history, tagged as coming from MCP', async () => {
    await rpc(token, 'prompts/get', {
      name: 'client_review',
      arguments: { clientId },
    })

    const { rows } = await db.query('SELECT source, template_key FROM generated_prompts')
    expect(rows).toHaveLength(1)
    expect(rows[0].source).toBe('mcp')
    expect(rows[0].template_key).toBe('client_review')
  })

  it('tags a prompt generated through the app as coming from the app', async () => {
    await request('/api/prompts/generate', {
      as: user,
      method: 'POST',
      body: { template_key: 'client_review', scope: 'client', client_id: clientId },
    })

    const { rows } = await db.query('SELECT source FROM generated_prompts')
    expect(rows[0].source).toBe('app')
  })
})

// ── Cross-account isolation ──────────────────────────────────────────────────

/**
 * One account's data staying out of another's, over MCP.
 *
 * `e2e/specs/isolation.e2e.ts` does this for the session-authenticated REST
 * surface. This is the same property for the token-authenticated one, which is
 * a separate door with a separate credential and therefore a separate way to
 * get it wrong.
 *
 * Every case is asserted twice: the intruder cannot see it, and the owner can.
 * Without the second half an endpoint that returns nothing to everybody would
 * pass an isolation test perfectly.
 */
describe('mcp account isolation', () => {
  let owner: TestUser
  let intruder: TestUser
  let ownerToken: string
  let intruderToken: string
  let clientId: string
  let projectId: string

  beforeEach(async () => {
    await seedBuiltInTemplates()
    owner = await createUser({ email: 'owner@example.test' })
    intruder = await createUser({ email: 'intruder@example.test' })
    ownerToken = await seedMcpToken(owner.id, { name: 'owner laptop' })
    intruderToken = await seedMcpToken(intruder.id, { name: 'intruder laptop' })

    const created = await request('/api/clients', {
      as: owner,
      method: 'POST',
      body: { companyName: 'Northwind Traders', email: 'ada@northwind.test' },
    })
    clientId = created.body.client.id
    projectId = await seedProject(owner.id, clientId)

    await request('/api/tasks', {
      as: owner,
      method: 'POST',
      body: { projectId, title: 'Send the proposal' },
    })
    await seedTransaction(owner.id, { clientId, projectId, amount: 4200 })
  })

  it('keeps another account’s clients out of search results', async () => {
    const result = await callTool(intruderToken, 'search_clients', { q: 'Northwind' })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.data as any).clients).toEqual([])
    expect(result.text).not.toContain('Northwind')
  })

  it('hides another account’s client behind a not-found', async () => {
    const result = await callTool(intruderToken, 'get_client_summary', { clientId })

    expect(result.isError).toBe(true)
    expect(result.text).not.toContain('Northwind')
  })

  it('keeps another account’s tasks out of reach', async () => {
    const result = await callTool(intruderToken, 'list_tasks', { clientId })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((result.data as any).tasks).toEqual([])
    expect(result.text).not.toContain('Send the proposal')
  })

  it('keeps another account’s money out of reach', async () => {
    const result = await callTool(intruderToken, 'get_client_financials', { clientId })

    expect(result.isError).toBe(true)
    expect(result.text).not.toContain('4200')
  })

  it('renders no context for another account’s client in a prompt', async () => {
    const res = await rpc(intruderToken, 'prompts/get', {
      name: 'client_review',
      arguments: { clientId },
    })

    expect(res.text).not.toContain('Northwind')
  })

  it('writes no prompt history to the intruder’s account for a refused prompt', async () => {
    await rpc(intruderToken, 'prompts/get', {
      name: 'client_review',
      arguments: { clientId },
    })

    const { rows } = await db.query('SELECT id FROM generated_prompts')
    expect(rows).toHaveLength(0)
  })

  /**
   * The other half. The same five calls that returned nothing to the intruder
   * must return the data to the account that owns it.
   */
  describe('while the owner’s own token still works', () => {
    it('finds the client', async () => {
      const result = await callTool(ownerToken, 'search_clients', { q: 'Northwind' })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.data as any).clients).toHaveLength(1)
    })

    it('summarises the client', async () => {
      const result = await callTool(ownerToken, 'get_client_summary', { clientId })

      expect(result.isError).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.data as any).name).toBe('Northwind Traders')
    })

    it('lists the task', async () => {
      const result = await callTool(ownerToken, 'list_tasks', { clientId })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.data as any).tasks).toHaveLength(1)
    })

    it('reports the money', async () => {
      const result = await callTool(ownerToken, 'get_client_financials', { clientId })

      expect(result.isError).toBe(false)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((result.data as any).totals.income).toBe(4200)
    })

    it('renders the client into a prompt', async () => {
      const res = await rpc(ownerToken, 'prompts/get', {
        name: 'client_review',
        arguments: { clientId },
      })

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((res.body as any).result.messages[0].content.text).toContain('Northwind')
    })
  })
})

// ── Write access ─────────────────────────────────────────────────────────────

/**
 * Write tools, and the permission that gates them.
 *
 * Two separate properties, and both need proving over real HTTP rather than
 * in a unit test: that a read-only token cannot write, and that a write-
 * capable token cannot write to somebody *else's* records. The second is the
 * one that would actually hurt — a write tool takes a `clientId`, which is the
 * foreign-key-in-a-request-body shape `lib/db/ownership.ts` exists for.
 */
describe('mcp write access', () => {
  let user: TestUser
  let readToken: string
  let writeToken: string
  let clientId: string
  let projectId: string

  beforeEach(async () => {
    user = await createUser()
    readToken = await seedMcpToken(user.id, { name: 'read only' })
    writeToken = await seedMcpToken(user.id, { name: 'read write', canWrite: true })

    const created = await request('/api/clients', {
      as: user,
      method: 'POST',
      body: { companyName: 'Northwind Traders' },
    })
    clientId = created.body.client.id
    projectId = await seedProject(user.id, clientId)
  })

  describe('a read-only token', () => {
    it('is not shown the write tools at all', async () => {
      const res = await rpc(readToken, 'tools/list')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const names = ((res.body as any).result.tools as Array<{ name: string }>).map(
        (t) => t.name,
      )

      expect(names).not.toContain('log_note')
      expect(names).not.toContain('update_client')
      expect(names).toContain('search_clients')
    })

    it('cannot log a note even by naming the tool directly', async () => {
      const res = await rpc(readToken, 'tools/call', {
        name: 'log_note',
        arguments: { clientId, body: 'Planted by a read-only token' },
      })

      // Unregistered, so the protocol itself rejects it.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = (res.body as any).result
      expect(result?.isError ?? true).toBe(true)

      const { rows } = await db.query('SELECT id FROM notes')
      expect(rows).toHaveLength(0)
    })

    it('cannot change a client', async () => {
      await rpc(readToken, 'tools/call', {
        name: 'update_client',
        arguments: { clientId, companyName: 'Taken over' },
      })

      const { rows } = await db.query(
        'SELECT company_name FROM clients WHERE id = $1',
        [clientId],
      )
      expect(rows[0].company_name).toBe('Northwind Traders')
    })
  })

  describe('a write-capable token', () => {
    it('logs a note, and it lands in the database', async () => {
      const result = await callTool(writeToken, 'log_note', {
        clientId,
        body: 'Spoke about the migration timeline',
        noteType: 'call',
      })

      expect(result.isError).toBe(false)

      const { rows } = await db.query(
        'SELECT body, note_type FROM notes WHERE client_id = $1',
        [clientId],
      )
      expect(rows).toHaveLength(1)
      expect(rows[0].body).toBe('Spoke about the migration timeline')
      expect(rows[0].note_type).toBe('call')
    })

    /**
     * Logging a note is not only an insert — it advances the client's
     * last-contact date, which is what makes the staleness queue work.
     */
    it('advances last contact when a note is logged', async () => {
      await callTool(writeToken, 'log_note', { clientId, body: 'Called them' })

      const { rows } = await db.query(
        'SELECT last_contact_date FROM clients WHERE id = $1',
        [clientId],
      )
      expect(rows[0].last_contact_date).not.toBeNull()
    })

    it('updates only the fields it was given', async () => {
      const result = await callTool(writeToken, 'update_client', {
        clientId,
        industry: 'Logistics',
      })

      // Asserted explicitly: an earlier version of this tool committed the
      // write and *then* threw on cache revalidation, so checking only the
      // database would have called that a pass while the model was being told
      // the change had failed.
      expect(result.isError).toBe(false)

      const { rows } = await db.query(
        'SELECT company_name, industry FROM clients WHERE id = $1',
        [clientId],
      )
      expect(rows[0].industry).toBe('Logistics')
      expect(rows[0].company_name).toBe('Northwind Traders')
    })

    it('creates a client', async () => {
      const result = await callTool(writeToken, 'create_client', {
        companyName: 'Contoso',
        leadSource: 'referral',
      })

      expect(result.isError).toBe(false)
      const { rows } = await db.query(
        'SELECT owner_id FROM clients WHERE company_name = $1',
        ['Contoso'],
      )
      expect(rows[0].owner_id).toBe(user.id)
    })

    it('creates and completes a task', async () => {
      const created = await callTool(writeToken, 'create_task', {
        projectId,
        title: 'Send the revised quote',
      })
      expect(created.isError).toBe(false)

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const taskId = (created.data as any).id
      const done = await callTool(writeToken, 'complete_task', { taskId })
      expect(done.isError).toBe(false)

      const { rows } = await db.query('SELECT is_done FROM tasks WHERE id = $1', [
        taskId,
      ])
      expect(rows[0].is_done).toBe(true)
    })

    it('reports a clear error for a client that does not exist', async () => {
      const result = await callTool(writeToken, 'log_note', {
        clientId: '3f1b8c4e-0000-4000-8000-000000000000',
        body: 'Nowhere',
      })

      expect(result.isError).toBe(true)
      expect(result.text.toLowerCase()).not.toContain('prisma')
    })

    it('exposes no tool that deletes anything', async () => {
      const res = await rpc(writeToken, 'tools/list')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const names = ((res.body as any).result.tools as Array<{ name: string }>).map(
        (t) => t.name,
      )

      expect(names.filter((n) => /delete|remove/i.test(n))).toEqual([])
    })
  })
})

/**
 * The write half of account isolation.
 *
 * An intruder holding a perfectly valid write-capable token of their own must
 * not be able to point it at another account's rows. Nothing about these
 * requests is malformed — the token is real, the body validates, and only the
 * id belongs to somebody else.
 */
describe('mcp write isolation', () => {
  let owner: TestUser
  let intruder: TestUser
  let intruderWriteToken: string
  let clientId: string
  let projectId: string

  beforeEach(async () => {
    owner = await createUser({ email: 'owner@example.test' })
    intruder = await createUser({ email: 'intruder@example.test' })
    intruderWriteToken = await seedMcpToken(intruder.id, { canWrite: true })

    const created = await request('/api/clients', {
      as: owner,
      method: 'POST',
      body: { companyName: 'Northwind Traders' },
    })
    clientId = created.body.client.id
    projectId = await seedProject(owner.id, clientId)
  })

  it('refuses to log a note against another account’s client', async () => {
    const result = await callTool(intruderWriteToken, 'log_note', {
      clientId,
      body: 'Planted',
    })

    expect(result.isError).toBe(true)
    const { rows } = await db.query('SELECT id FROM notes')
    expect(rows).toHaveLength(0)
  })

  it('refuses to change another account’s client', async () => {
    const result = await callTool(intruderWriteToken, 'update_client', {
      clientId,
      companyName: 'Taken over',
    })

    expect(result.isError).toBe(true)
    const { rows } = await db.query(
      'SELECT company_name FROM clients WHERE id = $1',
      [clientId],
    )
    expect(rows[0].company_name).toBe('Northwind Traders')
  })

  it('refuses to archive another account’s client', async () => {
    const result = await callTool(intruderWriteToken, 'set_client_archived', {
      clientId,
      archived: true,
    })

    expect(result.isError).toBe(true)
    const { rows } = await db.query('SELECT is_archived FROM clients WHERE id = $1', [
      clientId,
    ])
    expect(rows[0].is_archived).toBe(false)
  })

  it('refuses to hang a project off another account’s client', async () => {
    const result = await callTool(intruderWriteToken, 'create_project', {
      clientId,
      title: 'Planted',
    })

    expect(result.isError).toBe(true)
    const { rows } = await db.query('SELECT id FROM projects WHERE title = $1', [
      'Planted',
    ])
    expect(rows).toHaveLength(0)
  })

  it('refuses to hang a task off another account’s project', async () => {
    const result = await callTool(intruderWriteToken, 'create_task', {
      projectId,
      title: 'Planted',
    })

    expect(result.isError).toBe(true)
    const { rows } = await db.query('SELECT id FROM tasks')
    expect(rows).toHaveLength(0)
  })

  /** And the write still works where it is supposed to. */
  it('lets the intruder write to their own client', async () => {
    const own = await request('/api/clients', {
      as: intruder,
      method: 'POST',
      body: { companyName: 'Intruder Ltd' },
    })

    const result = await callTool(intruderWriteToken, 'log_note', {
      clientId: own.body.client.id,
      body: 'Legitimate',
    })

    expect(result.isError).toBe(false)
  })
})
