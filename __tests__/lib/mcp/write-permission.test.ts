import { describe, it, expect, vi } from 'vitest'

/**
 * Which tools a token is shown.
 *
 * The write permission is enforced by *not registering* the write tools on a
 * read-only token's server, rather than by refusing inside each handler. That
 * makes it structural — there is no handler to reach — but it also means the
 * only thing standing between a read-only token and a write is one `if` in
 * `buildMcpServer`. This pins it.
 *
 * The read tools are registered either way; a write-capable token is a
 * superset, never a different set.
 */

vi.mock('@/lib/db/client', () => ({ prisma: {} }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), updateTag: vi.fn() }))

const { buildMcpServer } = await import('@/lib/mcp/server')

const READ_TOOLS = [
  'search_clients',
  'get_client_summary',
  'list_tasks',
  'get_client_financials',
]

const WRITE_TOOLS = [
  'log_note',
  'update_client',
  'create_client',
  'set_client_archived',
  'create_project',
  'create_task',
  'complete_task',
]

/** The tool names an McpServer ended up with. */
function toolNames(canWrite: boolean): string[] {
  const server = buildMcpServer('owner-abc', canWrite)
  // The SDK keeps registered tools on the instance; read them back rather than
  // standing up a transport just to call tools/list.
  const registry = (server as unknown as { _registeredTools: Record<string, unknown> })
    ._registeredTools
  return Object.keys(registry ?? {}).sort()
}

describe('buildMcpServer tool registration', () => {
  it('gives a read-only token the read tools', () => {
    const names = toolNames(false)

    for (const tool of READ_TOOLS) {
      expect(names).toContain(tool)
    }
  })

  /**
   * Not "refuses the call" — does not advertise it. A model that cannot see a
   * tool never proposes it, so there is no denial to explain and nothing to
   * retry against.
   */
  it('does not even advertise write tools to a read-only token', () => {
    const names = toolNames(false)

    for (const tool of WRITE_TOOLS) {
      expect(names).not.toContain(tool)
    }
  })

  it('gives a write-capable token both sets', () => {
    const names = toolNames(true)

    for (const tool of [...READ_TOOLS, ...WRITE_TOOLS]) {
      expect(names).toContain(tool)
    }
  })

  /** Write access adds tools; it never swaps one set for another. */
  it('adds to the read set rather than replacing it', () => {
    const readOnly = toolNames(false)
    const writable = toolNames(true)

    expect(writable).toEqual(expect.arrayContaining(readOnly))
    expect(writable.length).toBe(readOnly.length + WRITE_TOOLS.length)
  })

  /**
   * Deletes were deliberately left out. Nothing over MCP should be able to
   * remove a client, a note or a task — those cascade and cannot be undone.
   */
  it('exposes no tool that deletes anything', () => {
    for (const name of toolNames(true)) {
      expect(name).not.toMatch(/delete|remove|destroy|purge/i)
    }
  })
})
