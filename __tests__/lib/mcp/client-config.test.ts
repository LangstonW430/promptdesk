import { describe, it, expect } from 'vitest'
import {
  TOKEN_PLACEHOLDER,
  mcpClientSetups,
  mcpEndpointUrl,
} from '@/lib/mcp/client-config'

/**
 * The config snippets users paste into their AI client.
 *
 * These are prose in a UI, which normally would not be worth testing — except
 * that each one fails in a way that looks like the *server* is broken. A
 * missing `"type": "http"` makes VS Code try to execute the URL; `mcpServers`
 * instead of `servers` makes it ignore the entry entirely; a space after the
 * colon in the Claude Desktop header makes Windows mangle the credential.
 * None of those produce an error that points back here.
 */

const APP_URL = 'https://promptdesk.example'
const TOKEN = 'pd_live_realtokenvalue'

function setup(id: string, token = TOKEN) {
  const found = mcpClientSetups(APP_URL, token).find((s) => s.id === id)
  if (!found) throw new Error(`No setup for ${id}`)
  return found
}

describe('mcpEndpointUrl', () => {
  it('points at the MCP route', () => {
    expect(mcpEndpointUrl(APP_URL)).toBe('https://promptdesk.example/api/mcp')
  })

  /**
   * A trailing slash in NEXT_PUBLIC_APP_URL is easy to leave in a Vercel env
   * var, and string concatenation would turn it into `//api/mcp`.
   */
  it('survives a trailing slash on the app URL', () => {
    expect(mcpEndpointUrl('https://promptdesk.example/')).toBe(
      'https://promptdesk.example/api/mcp',
    )
  })
})

describe('mcpClientSetups', () => {
  it('covers the four documented clients', () => {
    expect(mcpClientSetups(APP_URL, TOKEN).map((s) => s.id)).toEqual([
      'claude-code',
      'claude-desktop',
      'cursor',
      'vscode',
    ])
  })

  it('gives every client a location and a caveat', () => {
    for (const s of mcpClientSetups(APP_URL, TOKEN)) {
      expect(s.location.length).toBeGreaterThan(0)
      expect(s.note.length).toBeGreaterThan(0)
    }
  })

  /** A snippet that does not parse is a snippet that cannot possibly work. */
  it('emits valid JSON for every JSON client', () => {
    for (const s of mcpClientSetups(APP_URL, TOKEN)) {
      if (s.kind !== 'json') continue
      expect(() => JSON.parse(s.snippet), `${s.id} is not valid JSON`).not.toThrow()
    }
  })

  it('points every client at the same endpoint', () => {
    for (const s of mcpClientSetups(APP_URL, TOKEN)) {
      expect(s.snippet).toContain('https://promptdesk.example/api/mcp')
    }
  })
})

describe('Claude Code', () => {
  it('is a command carrying the token in an Authorization header', () => {
    const s = setup('claude-code')

    expect(s.kind).toBe('command')
    expect(s.snippet).toContain('claude mcp add --transport http')
    expect(s.snippet).toContain(`Authorization: Bearer ${TOKEN}`)
  })
})

describe('Claude Desktop', () => {
  /**
   * Desktop speaks stdio only. A `url` entry would be a configuration error,
   * not a connection — so the bridge is the whole point of this snippet.
   */
  it('bridges over stdio rather than configuring a URL directly', () => {
    const config = JSON.parse(setup('claude-desktop').snippet)
    const server = config.mcpServers.promptdesk

    expect(server.command).toBe('npx')
    expect(server.url).toBeUndefined()
    expect(server.args.some((a: string) => a.startsWith('mcp-remote@'))).toBe(true)
  })

  /**
   * Desktop on Windows does not escape spaces inside `args`. The header name
   * and value are therefore split across `args` and `env`, with no space after
   * the colon — mcp-remote's own documented workaround.
   */
  it('splits the header so a space can never reach args', () => {
    const config = JSON.parse(setup('claude-desktop').snippet)
    const server = config.mcpServers.promptdesk

    expect(server.args).toContain('Authorization:${AUTH_HEADER}')
    expect(server.env.AUTH_HEADER).toBe(`Bearer ${TOKEN}`)

    // The token itself must not appear in args, where the space problem lives.
    for (const arg of server.args) {
      expect(arg).not.toContain(TOKEN)
    }
  })

  it('pins mcp-remote rather than tracking latest', () => {
    const config = JSON.parse(setup('claude-desktop').snippet)
    const spec = config.mcpServers.promptdesk.args.find((a: string) =>
      a.startsWith('mcp-remote@'),
    )

    expect(spec).toMatch(/^mcp-remote@\d+\.\d+\.\d+$/)
  })
})

describe('Cursor', () => {
  it('uses the mcpServers key with a headers object', () => {
    const config = JSON.parse(setup('cursor').snippet)

    expect(Object.keys(config)).toEqual(['mcpServers'])
    expect(config.mcpServers.promptdesk.headers.Authorization).toBe(
      `Bearer ${TOKEN}`,
    )
  })

  it('points at the global config, not the committed project one', () => {
    expect(setup('cursor').location).toBe('~/.cursor/mcp.json')
  })
})

describe('VS Code', () => {
  /**
   * `servers`, not `mcpServers`. Pasting an `mcpServers` block into
   * .vscode/mcp.json silently does nothing.
   */
  it('uses the servers key, not mcpServers', () => {
    const config = JSON.parse(setup('vscode').snippet)

    expect(config.servers).toBeDefined()
    expect(config.mcpServers).toBeUndefined()
  })

  /** Without it, VS Code treats the entry as stdio and runs the URL. */
  it('declares the http transport explicitly', () => {
    const config = JSON.parse(setup('vscode').snippet)

    expect(config.servers.promptdesk.type).toBe('http')
  })

  /**
   * The one client that should not receive the token: it prompts for it and
   * stores it itself, which is better than any file we could write.
   */
  it('prompts for the token instead of embedding it', () => {
    const s = setup('vscode')
    const config = JSON.parse(s.snippet)

    expect(s.snippet).not.toContain(TOKEN)
    expect(config.inputs[0]).toMatchObject({ type: 'promptString', password: true })
    expect(config.servers.promptdesk.headers.Authorization).toContain('${input:')
  })
})

describe('placeholder mode', () => {
  it('leaks no real token when rendering general instructions', () => {
    for (const s of mcpClientSetups(APP_URL, TOKEN_PLACEHOLDER)) {
      expect(s.snippet).not.toContain(TOKEN)
    }
  })

  it('shows the placeholder where a token would go', () => {
    expect(setup('claude-code', TOKEN_PLACEHOLDER).snippet).toContain(
      TOKEN_PLACEHOLDER,
    )
  })
})
