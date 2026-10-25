import { describe, it, expect, vi } from 'vitest'
import { BUILT_IN_TEMPLATES } from '@/lib/prompt-engine/templates'
import { registerPrompts } from '@/lib/mcp/prompts'

/**
 * Which prompts get advertised, and what arguments each takes.
 *
 * Prompts are registered by looping `BUILT_IN_TEMPLATES`, which means a new
 * template appears over MCP with no code change — and also that a template
 * which cannot actually be served would be advertised silently. These tests
 * are what make the loop safe: they pin the count, the argument shape per
 * scope, and the one exclusion.
 */

vi.mock('@/lib/prompts', () => ({ generatePrompt: vi.fn() }))
vi.mock('@/lib/db/ownership', () => ({ ownsClient: vi.fn() }))

type Registration = { name: string; config: Record<string, unknown> }

/** Just enough McpServer to record what was registered. */
function fakeServer() {
  const registered: Registration[] = []
  const server = {
    registerPrompt(name: string, config: Record<string, unknown>) {
      registered.push({ name, config })
      return {}
    },
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { server: server as any, registered }
}

function register() {
  const { server, registered } = fakeServer()
  registerPrompts(server, 'owner-abc')
  return registered
}

/** The only template `generatePrompt` cannot produce. */
const EXCLUDED = 'invoice_cover_email'

describe('registerPrompts', () => {
  it('registers every built-in template except the unsupported one', () => {
    const names = register().map((r) => r.name)

    expect(names).toHaveLength(BUILT_IN_TEMPLATES.length - 1)
    expect(new Set(names).size).toBe(names.length)
  })

  /**
   * It needs six invoice-specific `extras`, and `PipelineInput` has no
   * `extras` field — driving it through the pipeline would render a prompt with
   * six empty placeholders rather than failing.
   */
  it('leaves out invoice_cover_email', () => {
    expect(register().map((r) => r.name)).not.toContain(EXCLUDED)
  })

  it('names prompts by template key, the identifier everything else uses', () => {
    const names = register().map((r) => r.name)
    const expected = BUILT_IN_TEMPLATES.map((t) => t.key).filter((k) => k !== EXCLUDED)

    expect(names.sort()).toEqual(expected.sort())
  })

  it('carries each template’s own name and description across', () => {
    for (const { name, config } of register()) {
      const template = BUILT_IN_TEMPLATES.find((t) => t.key === name)!
      expect(config.title).toBe(template.name)
      expect(config.description).toBe(template.description)
    }
  })

  describe('arguments by scope', () => {
    function schemaFor(key: string) {
      const found = register().find((r) => r.name === key)!
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return found.config.argsSchema as any
    }

    it('asks global prompts only for an optional objective', () => {
      const globals = BUILT_IN_TEMPLATES.filter(
        (t) => t.scope === 'global' && t.key !== EXCLUDED,
      )
      expect(globals.length).toBeGreaterThan(0)

      for (const template of globals) {
        const schema = schemaFor(template.key)
        expect(schema.safeParse({}).success).toBe(true)
        expect(schema.safeParse({ objective: 'grow retainers' }).success).toBe(true)
      }
    })

    it('requires a client id for client- and notes-scoped prompts', () => {
      const scoped = BUILT_IN_TEMPLATES.filter(
        (t) => t.scope === 'client' || t.scope === 'notes',
      )
      expect(scoped.length).toBeGreaterThan(0)

      for (const template of scoped) {
        const schema = schemaFor(template.key)
        expect(schema.safeParse({}).success).toBe(false)
        expect(schema.safeParse({ clientId: 'not-a-uuid' }).success).toBe(false)
        expect(
          schema.safeParse({ clientId: '3f1b8c4e-0000-4000-8000-000000000000' }).success,
        ).toBe(true)
      }
    })
  })

  /**
   * `fetchContext` never implemented the project branch — the fields exist in
   * `RetrievalSpec` but nothing reads them. Failing at registration means
   * adding such a template breaks the build rather than quietly serving an
   * empty context block.
   */
  it('refuses to register a project-scoped template', () => {
    const { server } = fakeServer()
    const template = {
      ...BUILT_IN_TEMPLATES[0],
      key: 'some_project_prompt',
      scope: 'project' as const,
    }
    expect(() => registerPrompts(server, 'owner-abc', [template])).toThrow(/project/)
  })
})
