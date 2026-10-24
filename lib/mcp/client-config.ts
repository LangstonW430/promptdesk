import { MCP_SERVER_INFO } from './config'

/**
 * What to paste into each AI client to connect it.
 *
 * Pure, no I/O, and the single source of truth for these four shapes. The
 * Settings page renders them with a real token so a user can paste without
 * thinking; the tests parse the JSON ones so a malformed config cannot ship.
 * `docs/mcp.md` carries the same snippets in prose for reading.
 *
 * None of these are guesses. Each is the shape the client's own documentation
 * specifies, and the differences between them are real:
 *
 * - **Claude Code** takes a command, and stores the result itself.
 * - **Claude Desktop** has no Streamable HTTP support at all. It speaks stdio,
 *   so a remote server needs the `mcp-remote` bridge in front of it. Its
 *   Custom Connectors path does do remote servers, but over OAuth, which this
 *   phase does not serve.
 * - **Cursor** takes `url` + `headers` under `mcpServers`.
 * - **VS Code** takes `url` + `headers` under `servers` — a different key —
 *   and prompts for secrets through `inputs` rather than storing them.
 *
 * Getting any of those four details wrong produces a failure that reads like
 * the server is broken, which is why they are written down once here rather
 * than retyped per surface.
 */

/** Stands in for a real token when showing the instructions generally. */
export const TOKEN_PLACEHOLDER = 'pd_live_YOUR_TOKEN_HERE'

/**
 * Pinned rather than `@latest`.
 *
 * This string ends up in a user's config file and keeps running long after
 * they paste it, so a major version bump should be something they opt into
 * rather than something that happens to them on a Tuesday.
 */
const MCP_REMOTE_VERSION = '0.15.2'

export type McpClientId = 'claude-code' | 'claude-desktop' | 'cursor' | 'vscode'

export interface McpClientSetup {
  id: McpClientId
  /** Display name, e.g. "Claude Code". */
  label: string
  /** Where the snippet goes: a config file path, or how to run it. */
  location: string
  kind: 'command' | 'json'
  snippet: string
  /** The one thing that will otherwise cost an hour. */
  note: string
}

/**
 * The endpoint URL from the app's canonical origin.
 *
 * Built with `URL` rather than string concatenation so a trailing slash on
 * `NEXT_PUBLIC_APP_URL` — which is easy to leave in a Vercel env var — cannot
 * produce `https://example.com//api/mcp`.
 */
export function mcpEndpointUrl(appUrl: string): string {
  return new URL('/api/mcp', appUrl).toString()
}

/** Every client's setup, with `token` interpolated where the client allows it. */
export function mcpClientSetups(appUrl: string, token: string): McpClientSetup[] {
  const url = mcpEndpointUrl(appUrl)
  const name = MCP_SERVER_INFO.name

  return [
    {
      id: 'claude-code',
      label: 'Claude Code',
      location: 'Run this in your terminal',
      kind: 'command',
      snippet: `claude mcp add --transport http ${name} ${url} \\\n  --header "Authorization: Bearer ${token}"`,
      note:
        'Keep the default --scope local, which writes to ~/.claude.json. Using ' +
        '--scope project would write .mcp.json into your repository with the ' +
        'token in it. Check the connection with /mcp.',
    },
    {
      id: 'claude-desktop',
      label: 'Claude Desktop',
      location:
        'claude_desktop_config.json — ~/Library/Application Support/Claude/ on macOS, %APPDATA%\\Claude\\ on Windows',
      kind: 'json',
      // Desktop speaks stdio only, so the remote server goes behind a bridge.
      // The header is split across `args` and `env` deliberately: Desktop on
      // Windows does not escape spaces inside `args`, which mangles the value.
      // Writing `Authorization:${AUTH_HEADER}` with no space, and letting the
      // env var carry the space, is the workaround mcp-remote documents.
      snippet: JSON.stringify(
        {
          mcpServers: {
            [name]: {
              command: 'npx',
              args: [
                '-y',
                `mcp-remote@${MCP_REMOTE_VERSION}`,
                url,
                '--transport',
                'http-only',
                '--header',
                'Authorization:${AUTH_HEADER}',
              ],
              env: { AUTH_HEADER: `Bearer ${token}` },
            },
          },
        },
        null,
        2,
      ),
      note:
        'Claude Desktop cannot reach an HTTP server directly, so this bridges ' +
        'it over stdio. Note the colon with no space after it — Desktop on ' +
        'Windows splits arguments on spaces and would break the header. Needs ' +
        'Node 18+, and a full restart of Desktop to pick up the change.',
    },
    {
      id: 'cursor',
      label: 'Cursor',
      location: '~/.cursor/mcp.json',
      kind: 'json',
      snippet: JSON.stringify(
        {
          mcpServers: {
            [name]: {
              url,
              headers: { Authorization: `Bearer ${token}` },
            },
          },
        },
        null,
        2,
      ),
      note:
        'Use the global ~/.cursor/mcp.json rather than a project .cursor/mcp.json, ' +
        'which is committed along with your token.',
    },
    {
      id: 'vscode',
      label: 'VS Code',
      location: '.vscode/mcp.json',
      kind: 'json',
      // The only snippet that does not carry the token: VS Code prompts for it
      // and stores it itself, which is strictly better than a file on disk.
      snippet: JSON.stringify(
        {
          inputs: [
            {
              id: `${name}-token`,
              type: 'promptString',
              description: 'PromptDesk MCP token',
              password: true,
            },
          ],
          servers: {
            [name]: {
              type: 'http',
              url,
              headers: { Authorization: `Bearer \${input:${name}-token}` },
            },
          },
        },
        null,
        2,
      ),
      note:
        'The token is deliberately not filled in here: VS Code prompts for it ' +
        'the first time the server starts and stores it securely, so it never ' +
        'reaches the file. Two details matter — the top-level key is "servers", ' +
        'not "mcpServers", and "type": "http" is required, or VS Code treats ' +
        'the URL as a command to run.',
    },
  ]
}

/** Just the Claude Code command — the common case, shown without a disclosure. */
export function claudeCodeCommand(appUrl: string, token: string): string {
  return mcpClientSetups(appUrl, token)[0].snippet
}
