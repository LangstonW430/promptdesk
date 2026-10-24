/**
 * What the MCP server calls itself.
 *
 * One constant, because the product is being renamed and the rest of this
 * codebase spells "PromptDesk" in twenty separate places — a wordmark in the
 * sidebar, a page title, a Stripe statement descriptor, a CSV filename. None
 * of those can be changed in one edit. This can.
 *
 * `name` is what an MCP client shows in its server list and what the user
 * types in `claude mcp add`, so it is the lowercase slug rather than the
 * display name. Nothing else under lib/mcp may spell the product name.
 */
export const MCP_SERVER_INFO = {
  name: 'promptdesk',
  version: '0.1.0',
} as const

/**
 * Ceilings on how much any one tool may return.
 *
 * An MCP response lands directly in a model's context window, so an unbounded
 * list is not merely slow — it crowds out the conversation it was meant to
 * inform. Every list tool takes a `limit` with one of these as its default and
 * cap, and reports `truncated` when it had to cut.
 */
export const MCP_LIMITS = {
  clients: { default: 20, max: 50 },
  tasks: { default: 25, max: 100 },
  /** Notes attached to a client summary. The client detail page loads 50. */
  notesPerClient: 10,
  /** Open tasks listed inside a client summary. */
  tasksPerClient: 10,
  /** Projects listed inside a client summary or financial breakdown. */
  projectsPerClient: 25,
} as const
