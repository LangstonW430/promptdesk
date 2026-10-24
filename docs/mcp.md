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

Every token grants **read access to everything in the account that issued it** —
clients, notes, tasks, projects and financials. There is no way to narrow that.

A token can additionally be granted **write access** when you create it, which
adds tools for logging notes, updating client details, and creating clients,
projects and tasks. Write access is **off by default** and is a property of the
token, not the account: you can keep a read-only token on a machine you share
and a read-write one on your laptop.

**Nothing can be deleted over MCP, ever.** There is no tool to remove a client,
a note, a task or a project, whatever permission the token carries. Deletes
cascade and cannot be undone, so they stay in the app where a human does them
deliberately. Archiving a client is the one destructive-ish action exposed, and
it is reversible.

Tokens issued before write access existed are read-only and stay that way.
There is no way to add the permission to an existing token — create a new one
and revoke the old.

Treat a token like a password. If a machine holding one is lost, revoke it.

---

## 1. Creating a token

1. Open **Settings**.
2. Under **MCP access tokens**, choose **New token**.
3. Name it after the machine or client it is for — "Laptop — Claude Code".
   The name is how you decide what to revoke later.
4. Decide whether to tick **Let this token make changes**. Leave it off unless
   you want your AI client writing to your records; you can always issue a
   second token later.
5. Copy the token. **It is shown once.** The setup snippets shown alongside it
   are already filled in with it, so the easiest path is to copy the one for
   your client rather than the bare token.

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

## 3. Connecting your AI agent

Four clients, four different shapes. The differences are not cosmetic — each
one fails in a way that looks like the server is broken, so the gotchas are
worth reading before you paste.

Settings fills all four in with your real token at the moment you create one,
and the **How to connect your AI agent** panel there shows them any time with
a placeholder. The snippets below use `pd_live_YOUR_TOKEN_HERE`; swap in yours.

Replace `http://localhost:3000` with your deployed URL where relevant.

### Claude Code

```bash
claude mcp add --transport http promptdesk http://localhost:3000/api/mcp \
  --header "Authorization: Bearer pd_live_YOUR_TOKEN_HERE"
```

Check it with `/mcp`. Keep the default `--scope local`, which writes to
`~/.claude.json` — `--scope project` would write `.mcp.json` into your
repository with the token in it.

### Claude Desktop

Claude Desktop **cannot talk to an HTTP MCP server directly.** It speaks stdio
only, and its Custom Connectors feature uses OAuth, which this phase does not
serve. So the remote server goes behind the `mcp-remote` bridge.

Edit `claude_desktop_config.json` — on macOS
`~/Library/Application Support/Claude/`, on Windows `%APPDATA%\Claude\`:

```json
{
  "mcpServers": {
    "promptdesk": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote@0.15.2",
        "http://localhost:3000/api/mcp",
        "--transport",
        "http-only",
        "--header",
        "Authorization:${AUTH_HEADER}"
      ],
      "env": {
        "AUTH_HEADER": "Bearer pd_live_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

**Note the colon with no space after it.** That is not a typo. Claude Desktop
on Windows does not escape spaces inside `args`, so a literal
`"Authorization: Bearer …"` arrives mangled. Splitting it — the name in `args`,
the value in `env`, where spaces are safe — is the workaround `mcp-remote`
documents. Requires Node 18+, and a full quit-and-reopen of Desktop.

### Cursor

Edit `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "promptdesk": {
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer pd_live_YOUR_TOKEN_HERE"
      }
    }
  }
}
```

Use the global `~/.cursor/mcp.json` rather than a project `.cursor/mcp.json`,
which is committed. Cursor also expands `${env:VAR}` inside `headers`, so you
can keep the token in your environment instead.

### VS Code

Edit `.vscode/mcp.json`:

```json
{
  "inputs": [
    {
      "id": "promptdesk-token",
      "type": "promptString",
      "description": "PromptDesk MCP token",
      "password": true
    }
  ],
  "servers": {
    "promptdesk": {
      "type": "http",
      "url": "http://localhost:3000/api/mcp",
      "headers": {
        "Authorization": "Bearer ${input:promptdesk-token}"
      }
    }
  }
}
```

Two details, both of which fail silently or confusingly:

- The top-level key is **`servers`**, not `mcpServers`. Pasting an
  `mcpServers` block here does nothing at all.
- **`"type": "http"` is required.** Without it VS Code assumes stdio and tries
  to run the URL as a shell command.

No token in the file: VS Code prompts for it the first time the server starts
and stores it itself, which is better than anything we could write to disk.

### Keeping the token out of places it shouldn't be

- `.cursor/mcp.json` and `.vscode/mcp.json` are **project files**. Prefer the
  global Cursor config, VS Code's `inputs`, and Claude Code's default
  `--scope local`.
- Passing a credential as a command-line argument puts it in the process list,
  where other users on the machine can read it with `ps`. On a shared machine,
  use `mcp-remote`'s `--header-file` instead, which takes a file of
  `Name: value` lines.

### Not supported yet

**claude.ai connectors.** They require OAuth rather than a bearer token, which
is Phase 2.

### When it doesn't work

| Symptom | Cause |
| --- | --- |
| `401` | Token revoked, mistyped, or the `Bearer ` prefix is missing |
| `406` | The client did not send `Accept: application/json, text/event-stream` |
| An HTML login page | `/api/mcp` is missing from `PUBLIC_PREFIXES` in `proxy.ts` |
| Tools listed but no write tools | The token was created without write access — issue a new one |
| `mcp-remote` stuck or looping | `rm -rf ~/.mcp-auth`, then restart the client |

---

## 4. Tools

Every tool is scoped to the account that issued the token. None of them takes
an owner or user argument; there is nothing to pass, because the owner comes
from the token.

### Reading

These four are available to any token.

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

### Writing

These seven appear **only if the token was granted write access**. A read-only
token does not see them in `tools/list` at all, so your AI client will not
offer them or try to use them.

Your client decides how to confirm a write. Claude Code and Claude Desktop
prompt before each tool call by default, and each tool declares whether it
overwrites anything (`destructiveHint`), so the ones that change existing data
prompt more loudly than the ones that only add.

| Tool | What it does |
| --- | --- |
| `log_note` | Record a call, meeting or note against a client |
| `update_client` | Change contact details, industry, pain points, requirements, opportunity notes or the next follow-up date |
| `create_client` | Add a new client |
| `set_client_archived` | Archive or restore a client |
| `create_project` | Add a project under a client |
| `create_task` | Add a to-do against a project |
| `complete_task` | Mark a task done, or reopen it |

Three things worth knowing about what these do beyond the obvious:

- **`log_note` does more than insert a note.** It advances the client's
  last-contact date, writes an activity record, and refreshes their
  relationship summary — all in one transaction. It is the right way to keep a
  client current after talking to them, and it is why "I just got off a call
  with Acme, they want the migration done before their audit" is a single tool
  call rather than three.
- **`create_project` moves a client's stage.** Stage is derived from projects,
  so adding a `proposed` project moves the client to "proposal out" and an
  `active` one moves them to "active". There is no stage to set directly.
- **`update_client` only touches the fields you pass.** Omitted fields are left
  alone; an empty string clears a date.

**No deletes.** There is deliberately no tool to remove a client, note, task or
project, at any permission level.

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
which is what makes Phase 2 an edit to one file rather than to every tool. It
returns the token's `canWrite` flag alongside the account id, and
`buildMcpServer` uses it to decide whether the write tools are registered at
all. That is why a read-only token does not merely get refused — the tools are
not on its server instance, so there is no handler to reach and nothing to
forget to check when an eighth write tool is added.

---

## 7. Phase 2: OAuth

Personal access tokens are right for Claude Code and for CI. claude.ai
connectors need OAuth 2.1, which is the next phase. The open questions are
which authorization server issues the tokens, whether reads should split into
scopes before write tools arrive, and whether tokens stay alongside OAuth.
