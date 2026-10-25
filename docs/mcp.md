# MCP Server

### Serving client context to an AI assistant directly

_Phase 1: read-only, authenticated with personal access tokens._

The prompt engine already compiles everything known about a client into a
single budgeted prompt. Until now the last step was manual — press Copy, open
ChatGPT or Claude, paste. The MCP server removes that step: an AI client
connects over the [Model Context Protocol](https://modelcontextprotocol.io)
and pulls the same context itself.

Inference stays on your side. This server does not call an AI model, exactly
as prompt generation in the app does not. It serves data and prompts; your
assistant does the thinking.

---

## 0. What a token can do

A token grants **read access to everything in the account that issued it** —
clients, notes, tasks, projects and financials. There are no scopes in this
phase.

It cannot change or delete anything. There are no write tools, and the only
thing the server itself writes is a token's own "last used" timestamp.

Treat a token like a password. If a machine holding one is lost, revoke it.

---

## 1. Creating a token

1. Open **Settings**.
2. Under **MCP access tokens**, choose **New token**.
3. Name it after the machine or client it is for — "Laptop — Claude Code".
   The name is how you decide what to revoke later.
4. Copy the token. **It is shown once.**

Only a SHA-256 hash is stored, so a token cannot be recovered or shown again.
If you lose one, revoke it and create another; nothing is lost but the thirty
seconds it takes.

Tokens look like `pd_live_…`. The prefix is deliberate: it makes a leaked
token recognisable in a log that should not have contained it, and legible to
the secret scanners that watch public repositories.

Revoking is immediate. A revoked token stays in the list, greyed out, rather
than disappearing — the point of revoking one is usually that it leaked, and
the row carries the record of when it was last used, which is the only
evidence about whether anyone reached it first.

---

## 2. Testing with MCP Inspector

The Inspector is the quickest way to see what the server exposes.

```bash
npm run dev                          # in one terminal
npx @modelcontextprotocol/inspector  # in another
```

In the Inspector:

| Field | Value |
| --- | --- |
| Transport Type | **Streamable HTTP** |
| URL | `http://localhost:3000/api/mcp` |
| Header Name | `Authorization` |
| Header Value | `Bearer pd_live_…` |

Press **Connect**, then look at the **Tools** and **Prompts** tabs. Calling
`search_clients` with no arguments is the fastest confirmation that real data
is coming back.

Against a deployed instance, use `https://your-app.vercel.app/api/mcp`.

---

## 3. Adding the server to Claude Code

```bash
claude mcp add --transport http promptdesk http://localhost:3000/api/mcp \
  --header "Authorization: Bearer pd_live_your_token_here"
```

For a deployed instance, swap the URL:

```bash
claude mcp add --transport http promptdesk https://your-app.vercel.app/api/mcp \
  --header "Authorization: Bearer pd_live_your_token_here"
```

Run `/mcp` inside Claude Code to check the connection. `claude mcp add` stores
the configuration without validating it, so a bad token is accepted at add
time and only fails on connect.

The default `--scope local` keeps the token in `~/.claude.json`, which is
usually what you want: **do not** use `--scope project`, because that writes
`.mcp.json` into the repository and your token with it.

If you prefer to configure it by hand, the equivalent entry is:

```json
{
  "mcpServers": {
    "promptdesk": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer ${PROMPTDESK_TOKEN}"
      }
    }
  }
}
```

`${PROMPTDESK_TOKEN}` is expanded from the environment, which keeps the token
out of the file.

### Claude Desktop and claude.ai

Claude Desktop connects to Streamable HTTP servers the same way, via its
developer settings.

claude.ai connectors are **not** supported in this phase — they require OAuth
rather than a bearer token. That is Phase 2.

---

## 4. Tools

All four are read-only and scoped to the account that issued the token. None
of them takes an owner or user argument; there is nothing to pass, because the
owner comes from the token.

### `search_clients`

Find clients, optionally narrowed. All arguments are optional.

| Argument | Type | Notes |
| --- | --- | --- |
| `q` | string | Substring of company name, contact name or email |
| `stage` | enum | `lead`, `contacted`, `proposal_out`, `active`, `past`, `lost` |
| `tag` | string | Tag label, case-insensitive |
| `staleDays` | integer | No contact in this many days, and still in an open stage |
| `includeArchived` | boolean | Defaults to false |
| `limit` | integer | 1–50, defaults to 20 |

Returns a row per client with the derived stage, the value of their open
projects, and their tags, plus `total` and `truncated`.

**On stage:** a client's stage is not a stored field. It is derived from their
projects and contact history — a client with an active project *is* active, one
with a quote out *is* proposal_out. See `lib/clients/stage.ts` for the rule and
why it is computed rather than kept in a column.

### `get_client_summary`

Everything about one client: profile, derived stage, projects, the ten most
recent notes, and the rolling relationship summary. Takes `clientId`.

The `relationshipSummary` is worth knowing about: it is a compressed history of
the relationship, maintained automatically, so a client with two years of notes
still fits in a useful amount of context.

### `list_tasks`

| Argument | Type | Notes |
| --- | --- | --- |
| `clientId` | uuid | Tasks on any of this client's projects |
| `projectId` | uuid | |
| `status` | enum | `open`, `done`, `all`. Defaults to `open` |
| `due` | enum | `today` or `overdue` |
| `limit` | integer | 1–100, defaults to 25 |

A task belongs to a project, and the project belongs to a client — tasks have
no client of their own — so `clientId` filters through the project. Each
returned task names both.

`due` only ever matches outstanding work, so combining it with `status: "done"`
is refused rather than answered with an empty list.

### `get_client_financials`

A profit-and-loss breakdown per project for one client, plus invoice totals by
status. Takes `clientId` and optional `includeArchived`.

**Read the two blocks separately.** `projects` reports money recorded as
transactions; `invoices` reports what was billed. A Stripe-collected invoice
appears in both, so adding them together double-counts it. They are reported
side by side rather than summed for exactly that reason.

---

## 5. Prompts

Every built-in prompt template is exposed as an MCP prompt, named by its
template key — `business_advisor`, `client_review`, `follow_up_email` and so
on. Your client lists them; `/mcp` in Claude Code shows them as slash
commands.

These are the same generators the Prompts page uses, driven by the same engine.
No prompt text is duplicated, and a template added to the app appears over MCP
with no code change.

Arguments follow the template's scope:

- **Global** templates (business advisor, action plan, weekly planning, revenue
  analysis, follow-up recommendations) take an optional `objective`.
- **Client** and **notes** templates take a required `clientId` and an optional
  `objective`.

`objective` is worth supplying. It does not just appear in the text — it steers
which clients, notes and tasks are selected into the context block in the first
place.

Two things are deliberately absent:

- **`invoice_cover_email`** is not exposed. It needs invoice-specific
  substitutions (number, total, due date, line items, payment link) that the
  retrieval pipeline has no way to supply, so serving it needs an `invoiceId`
  and a separate code path. Use the invoice page for now.
- **Finance series and dashboard aggregates** are not exposed as tools. They are
  cached per account for the app's own rendering, and serving a cached
  aggregate from a path nobody is reasoning about is a good way to report a
  stale number as a fresh one.

### Prompts are rate-limited, and tools are not, much

Generating a prompt runs retrieval, scoring and budgeting — the most expensive
thing the app does. It shares one budget with the Prompts page: 20 per minute
per account. Tool calls are capped at 60 per minute per token.

Prompts also appear in your prompt history in the app, tagged as having come
from MCP so you can tell them apart from ones you generated yourself.

---

## 6. How authentication works

Worth knowing if you are reading the code.

`/api/mcp` is listed in `PUBLIC_PREFIXES` in `proxy.ts`, which means the
session gate does not run on it. That is necessary rather than lax: an MCP
client sends a bearer token and no cookies, so the gate would redirect every
tool call to `/login` and nothing would ever work. The same was true of the
Stripe webhook endpoint, and for the same reason.

Public there means "no session required", not "unauthenticated". The route
resolves the `Authorization` header to an account through
`lib/mcp/auth.ts:resolveMcpOwner` *before* an MCP server instance is
constructed, and that account id is closed over by every tool and prompt on it.
A tool therefore has no owner argument to accept and no session to consult. A
missing, malformed, unknown or revoked token is a 401 that reaches no query.

All four failures produce the same 401 with the same message. Distinguishing
them would tell an unauthenticated caller which tokens exist.

`resolveMcpOwner` is the only place that decides whose data a request may see,
which is what makes Phase 2 an edit to one file rather than to every tool.

---

## 7. Phase 2: OAuth

Personal access tokens are right for Claude Code and for CI. claude.ai
connectors need OAuth 2.1, which is the next phase. The open questions are
which authorization server issues the tokens, whether reads should split into
scopes before write tools arrive, and whether tokens stay alongside OAuth.
