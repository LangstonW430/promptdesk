# PromptDesk — AI-Assisted CRM for Solo Operators

### Complete Product Specification & System Architecture

_A lightweight business command center for freelancers, consultants, and small service businesses. AI-powered through intelligent prompt generation — no AI API required._

> **Historical document.** This is the specification the project was built
> against, kept as a record of the original design. The code has moved on in
> places — most visibly, clients no longer carry a `status` column (their stage
> is derived from their projects) and no `estimated_value` (value comes from
> project budgets). For what the app does *now*, see the
> [README](../README.md).

---

## 0. Design Philosophy

Every decision in this document resolves toward one principle: **the product is a personal business assistant, not an enterprise CRM.** When a feature could be built two ways, the version that gets a busy solo operator to a revenue-generating action faster wins.

The defining architectural bet is the **prompt-generation model**. Rather than embedding an LLM, PromptDesk acts as a _context compiler_: it owns the structured client data, assembles the most relevant slice of it, engineers a high-quality prompt, and hands the user a one-click copyable block to paste into ChatGPT, Claude, Gemini, Perplexity, or Grok. This keeps operating costs near zero, sidesteps per-token billing and rate limits, avoids vendor lock-in, and lets the product ride every model upgrade for free. The trade-off — a manual copy/paste step — is acceptable for the target user and is designed to be replaceable by direct integration later without touching the data layer.

---

## 1. Product Specification

### 1.1 What PromptDesk is

PromptDesk is a single-tenant-per-user CRM where one business owner manages their own pipeline of leads and clients. It combines a fast, opinionated contact and pipeline manager with a **Prompt Builder Engine** that turns CRM data into optimized AI prompts for planning, client analysis, and decision support.

### 1.2 Primary jobs to be done

- **"Who do I contact today, and what do I say?"** — the Daily Action Center and outreach prompts.
- **"What's the state of my business?"** — the dashboard and Business Action Plan prompt.
- **"Is this client healthy / worth my time?"** — Client Insight prompts and opportunity scoring.
- **"Turn my messy notes into action items."** — Note Analysis prompts.

### 1.3 Non-goals (explicit)

No team permissions, departments, hierarchies, approval workflows, sales-team management, or enterprise reporting suites. No multi-user collaboration in MVP. No mandatory configuration before first value. No built-in LLM calls in MVP.

### 1.4 Core capability summary

| Area              | MVP capability                                                             |
| ----------------- | -------------------------------------------------------------------------- |
| Client management | Create / edit / archive / delete, full standard field set, status pipeline |
| Custom data       | Notes, custom fields, tags, attachments, structured client intelligence    |
| Pipeline          | Kanban + list views, drag-to-change status, value tracked on projects      |
| Follow-ups        | Per-client next-action dates surfaced in a Daily Action Center             |
| Prompt generation | Business Advisor, Business Action Plan, Client Insight, Note Analysis      |
| Prompt engine     | Reusable templates, token budgeting, context prioritization, history       |
| Dashboard         | Pipeline value, lead/client counts, forecasting, recommended actions       |
| Export            | Copy-to-clipboard, TXT, Markdown, PDF                                      |

---

## 2. User Stories

Written from the perspective of **Sam**, a solo freelance web developer, and grouped by epic. Each carries an implied acceptance criterion that the action takes seconds, not minutes.

### Epic A — Onboarding & setup

- As Sam, I can sign up with email or Google and reach a usable dashboard in under two minutes, with sample data I can clear.
- As Sam, I can import existing contacts from a CSV so I'm not starting from an empty screen.

### Epic B — Client management

- As Sam, I can add a client in one short form and immediately set their status; the value of the work lives on a project so one client can carry several opportunities.
- As Sam, I can move a client through the pipeline by dragging their card from _Lead_ to _Won_.
- As Sam, I can archive a dead lead without losing its history, and restore it later.
- As Sam, I can search and filter clients by name, status, industry, tag, or "not contacted in 30 days."

### Epic C — Custom data & intelligence

- As Sam, I can add unlimited timestamped notes to a client and tag them as a call, meeting, or email.
- As Sam, I can record pain points, requirements, and an opportunity assessment in dedicated structured fields.
- As Sam, I can attach a proposal PDF or screenshot to a client.
- As Sam, I can define custom fields (e.g., "Hosting provider") without a developer.

### Epic D — Daily operations

- As Sam, I open the app and immediately see who I need to follow up with today and which deals are stalling.
- As Sam, I can mark a follow-up done and schedule the next one in a single interaction.

### Epic E — Prompt generation

- As Sam, I click **Generate Business Action Plan Prompt** and get a complete, ready-to-paste prompt covering my whole pipeline.
- As Sam, on any client I click **Generate Client Insight Prompt** and get a prompt scoped to just that client.
- As Sam, after writing notes I click **Copy Analysis Prompt** to extract action items and deadlines.
- As Sam, I can pick a template (Revenue Analysis, Lead Qualification, etc.) and generate a prompt from it.
- As Sam, I can copy a generated prompt with one click, or export it as TXT, Markdown, or PDF.
- As Sam, I can see my recently generated prompts and re-open or re-run any of them.
- As Sam, I trust that the prompt won't dump my entire database — it includes only what's relevant and stays within a sensible length.

### Epic F — Dashboard & insight

- As Sam, I see total pipeline value and a simple revenue forecast weighted by stage.
- As Sam, I see a "recommended actions" list derived from rules (stale clients, hot leads, overdue follow-ups).

---

## 3. Database Schema

PostgreSQL. Every business table carries an `owner_id` foreign key to `users` — this is the single-tenant isolation boundary and is enforced at the row level. Flexible/optional data uses `JSONB` to avoid schema churn while keeping structured fields first-class.

```sql
-- ============ IDENTITY ============
users (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email           text UNIQUE NOT NULL,
  full_name       text,
  business_name   text,
  business_type   text,            -- "web dev", "design consultant", etc. (feeds prompt context)
  default_ai      text,            -- preferred destination: chatgpt|claude|gemini|...
  created_at      timestamptz NOT NULL DEFAULT now(),
  settings        jsonb NOT NULL DEFAULT '{}'  -- token budget, currency, timezone
)

-- ============ CLIENTS ============
clients (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name       text,
  contact_name       text,
  email              text,
  phone              text,
  website            text,
  industry           text,
  company_size       text,
  lead_source        text,
  status             text NOT NULL DEFAULT 'lead',     -- lead|contacted|proposal_sent|negotiating|won|lost
  estimated_value    numeric(12,2),  -- superseded: value lives on projects.budget
  project_type       text,
  pain_points        text,
  requirements       text,
  opportunity_notes  text,
  last_contact_date  date,
  next_followup_date date,
  custom_fields      jsonb NOT NULL DEFAULT '{}',       -- user-defined key/values
  is_archived        boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  search_vector      tsvector                            -- maintained by trigger
)

-- ============ NOTES / ACTIVITY ============
notes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  body        text NOT NULL,
  note_type   text NOT NULL DEFAULT 'note',   -- note|call|meeting|email
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now()
)

activities (                                   -- system + manual timeline events
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id   uuid REFERENCES clients(id) ON DELETE CASCADE,
  type        text NOT NULL,                    -- status_changed|note_added|followup_done|prompt_generated
  detail      jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
)

-- ============ FOLLOW-UPS / TASKS ============
tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id   uuid REFERENCES clients(id) ON DELETE CASCADE,
  title       text NOT NULL,
  due_date    date,
  is_done     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
)

-- ============ TAGS (many-to-many) ============
tags (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label     text NOT NULL,
  color     text,
  UNIQUE (owner_id, label)
)
client_tags (
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  tag_id    uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (client_id, tag_id)
)

-- ============ ATTACHMENTS ============
attachments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  file_name   text NOT NULL,
  storage_key text NOT NULL,        -- object-storage path
  mime_type   text,
  size_bytes  bigint,
  created_at  timestamptz NOT NULL DEFAULT now()
)

-- ============ PROMPT SYSTEM ============
prompt_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid REFERENCES users(id) ON DELETE CASCADE,  -- NULL = system/built-in template
  key           text NOT NULL,         -- business_advisor|weekly_planning|revenue_analysis|...
  name          text NOT NULL,
  description   text,
  version       integer NOT NULL DEFAULT 1,
  body          text NOT NULL,         -- template with {{placeholders}}
  scope         text NOT NULL,         -- global|client|notes
  token_budget  integer NOT NULL DEFAULT 4000,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
)

generated_prompts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  template_id   uuid REFERENCES prompt_templates(id) ON DELETE SET NULL,
  template_key  text NOT NULL,
  scope         text NOT NULL,
  client_id     uuid REFERENCES clients(id) ON DELETE SET NULL,
  rendered_text text NOT NULL,         -- the final prompt the user copied
  token_count   integer,
  context_meta  jsonb NOT NULL DEFAULT '{}',  -- which records were included, scores
  is_saved      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
)
```

**Key indexes:** `clients(owner_id, status)`, `clients(owner_id, next_followup_date)`, `GIN(clients.search_vector)`, `GIN(clients.custom_fields)`, `notes(client_id, occurred_at DESC)`, `generated_prompts(owner_id, created_at DESC)`.

**Why JSONB for custom fields:** custom fields and prompt context metadata are inherently user-shaped and sparse. JSONB gives schema flexibility with a GIN index for query performance, avoiding an entity-attribute-value table that would slow every read.

---

## 4. Entity Relationship Diagram (description)

The graph is a hub-and-spoke centered on two entities.

`users` is the root. It owns everything; deleting a user cascades to all their data, which is the clean tenant-isolation story.

`clients` is the central business entity. It has a **one-to-many** relationship with `notes`, `activities`, `tasks`, and `attachments` — each of those holds a `client_id` foreign key. `clients` has a **many-to-many** relationship with `tags`, resolved through the `client_tags` join table.

`prompt_templates` stands somewhat apart: built-in templates have a `NULL owner_id` (shared by all users), while user-customized templates point to a `users` row. `generated_prompts` is the audit/history record — it references the `template` it came from and optionally the single `client` it was scoped to, and it stores the fully rendered text so history is preserved even if the underlying client or template later changes.

`activities` is a denormalized timeline feed pointing at both `users` and (optionally) `clients`, written by the application whenever something noteworthy happens. It is read-optimized for the dashboard's "recent activity" panel.

Cardinality summary: `users 1—* clients`, `clients 1—* {notes, tasks, attachments, activities}`, `clients *—* tags`, `users 1—* generated_prompts`, `prompt_templates 1—* generated_prompts`.

---

## 5. Feature Breakdown

### 5.1 Client management

Single-page client list with toggle between **Kanban** (columns per status, drag to advance) and **table** views. A client detail panel slides in from the right with tabs for Overview, Notes, Intelligence (pain points / requirements / opportunity), Tasks, and Attachments. Archive is a soft flag; delete requires confirmation and is permanent.

### 5.2 Daily Action Center

The default landing module. Three rule-driven queues: **Overdue follow-ups** (`next_followup_date < today`), **Hot leads** (status in lead/contacted, ranked by the value of their open projects), and **Going cold** (no contact in 30+ days, not won/lost). Each row has a "Generate outreach prompt" shortcut.

### 5.3 Dashboard

Cards for total leads, active clients, weighted pipeline value, and a revenue forecast. The forecast is a transparent rules-based calculation — `Σ (open project budgets × stage_probability)`, where open means a proposed or active project — with default probabilities (lead 10%, contacted 25%, proposal 50%, negotiating 70%) the user can adjust in settings. No black-box ML; the math stays explainable. Panels also show recent activity, recommended actions, conversion rate, recently generated prompts, and saved templates.

### 5.4 Prompt generation features

Four entry points, all powered by the same engine (Section 7):

- **Business Advisor** — flexible generator where the user picks an objective ("Which leads are most likely to convert?", "Which clients haven't been contacted recently?") and the engine assembles matching context.
- **Business Action Plan** — a single prominent button producing a structured prompt requesting Executive Summary, Priority Opportunities, Daily Actions, a 7-day Weekly Plan, Revenue Growth Opportunities, Risk Assessment, and Suggested Outreach Messages.
- **Client Insight** — per-client button producing a prompt requesting health assessment, conversion probability, opportunity score, next actions, likely objections, upsell opportunities, and a relationship summary.
- **Note Analysis** — produces a prompt to summarize notes, extract action items, detect deadlines, identify pain points, and draft follow-ups.

Every generated prompt renders in a clean panel with a **Copy** button, **Export** menu (TXT / Markdown / PDF), and a one-tap "open in" link that deep-links to the user's preferred AI destination so they can paste immediately.

### 5.5 Export

Copy uses the Clipboard API. TXT and Markdown are generated client-side. PDF is rendered server-side from the Markdown for consistent formatting.

---

## 6. System Architecture (description)

A **modular monolith** built on Next.js, deployed serverlessly. The diagram, described top to bottom:

**Client tier** — the browser runs the Next.js React app (App Router). UI talks to the backend through server actions and a thin REST surface. The Clipboard and File-download APIs live entirely here; export-to-clipboard never touches the server.

**Application tier** — Next.js server actions / route handlers running as serverless functions. This tier holds the domain logic in clear modules: `clients`, `notes`, `tasks`, `dashboard`, and the **Prompt Builder Engine**. Auth middleware sits in front of every handler and injects the authenticated `owner_id`, which scopes every query.

**Data tier** — managed PostgreSQL (Supabase or Neon) for all relational data, Postgres full-text search for the search feature, and object storage (Supabase Storage / S3) for attachments. A future `pgvector` extension slot is reserved for semantic search and client memory.

**External edge** — there are deliberately **no synchronous calls to AI providers**. The only external interaction is the user manually pasting a generated prompt into their chosen tool. This is the architectural firewall that keeps cost and complexity low; it can later be replaced by an optional `AIProvider` adapter module without changing anything upstream.

Cross-cutting: authentication and storage are provided by the same managed platform to minimize moving parts; CI/CD runs through GitHub to Vercel; observability via the host's built-in logs plus a lightweight error tracker (Sentry).

---

## 7. Prompt Generation Architecture

This is the system's differentiator. It is a deterministic pipeline that converts CRM data into an optimized prompt string. Six stages:

### 7.1 Data retrieval strategy

Each template declares its **scope** (`global`, `client`, or `notes`) and a **retrieval spec** — which tables, filters, and ordering it needs. A `global` template (Action Plan) pulls active clients, open tasks, recent activities, and pipeline aggregates. A `client` template pulls one client plus its notes, tasks, and recent activities. Retrieval is parameterized and indexed (Section 3), never a full table scan.

### 7.2 Context assembly & deduplication

Retrieved rows are normalized into a canonical intermediate form (plain objects, consistent date/currency formatting). Deduplication removes repeated facts — e.g., if a client's industry already appears in the profile block, it is not repeated in each note summary. Notes are deduped by near-identical content hashing to drop copy-paste duplicates.

### 7.3 Context prioritization (the ranking model)

Because prompts must fit a token budget, the engine scores every candidate context item and includes them highest-first until the budget is hit. The default scoring is a transparent weighted formula:

```
score = w1 * recency        (newer activity ranks higher)
      + w2 * deal_value      (higher open-project value ranks higher)
      + w3 * stage_urgency   (negotiating/proposal > lead)
      + w4 * staleness_risk  (overdue follow-ups get a boost)
      + w5 * relevance        (keyword match to the chosen objective)
```

This keeps prioritization explainable and tunable without a model. The included items are recorded in `generated_prompts.context_meta` so the user can see _why_ a record was included.

### 7.4 Token budgeting & compression

Each template carries a `token_budget` (default ~4000, configurable in settings to suit different models' practical paste limits). A fast token estimator (≈ chars/4, refined per template) measures the assembled context. If over budget, the engine compresses progressively: full notes → one-line summaries → counts only ("12 older notes omitted"). The profile block and the explicit user objective are never dropped; low-scored historical context is the first to go. This guarantees the prompt is dense with relevant signal and free of noise.

### 7.5 Prompt engineering layer

The template body is the engineered scaffold and is provider-agnostic by design. Each template uses a consistent structure proven to lift reasoning quality across models: a **role assignment** ("You are an expert business advisor for a solo freelancer…"), the **business context** (owner's business type), the **structured data block** (the assembled context, clearly delimited), an **explicit task** with a **requested output structure**, and **reasoning instructions** ("think step by step, justify priorities by deal value and recency"). Output sections are spelled out so any model returns a usable, consistently-shaped answer.

### 7.6 Optimization pipeline & long-term memory

- **Versioning** — `prompt_templates.version` increments on edits; `generated_prompts` records the `template_key` and a snapshot, so historical prompts remain reproducible.
- **Template management** — built-in templates ship with `owner_id = NULL`; a user editing one creates an owned copy (copy-on-write).
- **Long-term client memory** — for each client the engine maintains a rolling, compressed **relationship summary** (derived from notes and status history) stored on the client record. This lets a Client Insight prompt carry months of history in a few hundred tokens instead of dumping every note. This summary is the natural extension point for `pgvector` semantic retrieval later.
- **Quality loop** — generated prompts can be rated by the user (thumbs up/down); aggregate ratings per template guide future template tuning. No data leaves the user's account.

The result: from any AI platform, the user pastes a prompt that is role-primed, tightly scoped, deduplicated, budget-bounded, and structured for a predictable high-quality answer.

---

## 8. Recommended Technology Stack

| Layer            | Choice                                                     | Why                                                                                                                                                                                            |
| ---------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Frontend**     | Next.js (React) + TypeScript, App Router                   | One framework for UI and backend reduces moving parts for a small team; React's ecosystem and Server Components give both speed and a premium feel. TypeScript prevents whole classes of bugs. |
| **UI / styling** | Tailwind CSS + shadcn/ui + Radix primitives                | Delivers the "fast, minimal, premium" aesthetic quickly with accessible, unopinionated components you fully own.                                                                               |
| **Backend**      | Next.js server actions + route handlers (modular monolith) | A monolith is the right call for a solo-targeted product: lower ops burden, simpler deploys, cheaper. Module boundaries keep it clean and splittable later.                                    |
| **Database**     | PostgreSQL (Supabase or Neon)                              | Relational integrity for pipeline data, JSONB for flexible custom fields, native full-text search, and a clear path to `pgvector`. Mature, cheap, portable.                                    |
| **ORM**          | Prisma (or Drizzle)                                        | Type-safe queries and migrations that match the TypeScript stack and accelerate solo development. Drizzle is the lighter-weight alternative if raw performance and SQL control matter more.    |
| **Auth**         | Supabase Auth (or Clerk)                                   | Email + Google social login out of the box, row-level security tie-in, minimal setup. Clerk is the alternative if you want polished prebuilt auth UI.                                          |
| **Search**       | Postgres full-text (`tsvector` + GIN)                      | Free, fast enough for a single user's data, no extra service to run. Elasticsearch would be overkill and a recurring cost.                                                                     |
| **File storage** | Supabase Storage / S3-compatible                           | Pay-per-use object storage for attachments; keeps large blobs out of the database.                                                                                                             |
| **PDF export**   | Server-side render (e.g., Puppeteer/`@react-pdf`)          | Consistent, printable prompt exports independent of the browser.                                                                                                                               |
| **Hosting**      | Vercel (app) + Supabase/Neon (data)                        | Serverless scaling, generous low/free tiers, zero-config deploys — matches the low-operating-cost requirement.                                                                                 |
| **CI/CD**        | GitHub → Vercel preview/prod                               | Push-to-deploy, preview environments per pull request.                                                                                                                                         |
| **Monitoring**   | Host logs + Sentry                                         | Lightweight error and performance visibility without standing up infrastructure.                                                                                                               |

The throughline: a **single integrated, mostly-managed stack** so one developer can build, ship, and operate the whole product cheaply — and every choice has a defined upgrade path rather than a rewrite.

---

## 9. API Structure

REST-style endpoints (implemented as Next.js route handlers / server actions). All are authenticated; `owner_id` is derived from the session, never the request body.

```
# Auth handled by Supabase/Clerk middleware

# Clients
GET    /api/clients               ?status=&q=&tag=&stale=  list/filter/search
POST   /api/clients               create
GET    /api/clients/:id           detail (+ notes, tasks, attachments)
PATCH  /api/clients/:id           edit / change status
POST   /api/clients/:id/archive   soft archive / restore
DELETE /api/clients/:id           permanent delete
POST   /api/clients/import        CSV import

# Notes & activity
GET    /api/clients/:id/notes
POST   /api/clients/:id/notes
DELETE /api/notes/:id
GET    /api/activities            recent timeline feed

# Tasks / follow-ups
GET    /api/tasks                 ?due=today|overdue
POST   /api/tasks
PATCH  /api/tasks/:id             mark done / reschedule

# Tags & attachments
GET/POST /api/tags
POST   /api/clients/:id/tags
POST   /api/clients/:id/attachments   (signed upload URL flow)

# Dashboard
GET    /api/dashboard             aggregates: counts, pipeline value, forecast, recommendations

# Prompt system  ── the core
GET    /api/prompt-templates                     list built-in + custom
POST   /api/prompt-templates                     create custom template
PATCH  /api/prompt-templates/:id                 edit (copy-on-write, version bump)
POST   /api/prompts/generate                     { template_key, scope, client_id?, objective? } -> rendered prompt + token_count + context_meta
GET    /api/prompts/history       ?saved=true     recently generated prompts
POST   /api/prompts/:id/save                      pin to saved
POST   /api/prompts/:id/rate                      thumbs up/down
GET    /api/prompts/:id/export    ?format=txt|md|pdf
```

The `POST /api/prompts/generate` endpoint is the heart of the system — it runs the full Section 7 pipeline and returns the finished prompt plus transparency metadata, but it makes **no external AI call**.

---

## 10. Development Roadmap

**Phase 0 — Foundations (Week 1)**
Repo, CI/CD, auth, database, base layout and design system. A logged-in user reaches an empty dashboard.

**Phase 1 — Core CRM (Weeks 2–3)**
Client CRUD, status pipeline (Kanban + table), notes, tags, search, archive/delete, CSV import. The product is a usable plain CRM.

**Phase 2 — Prompt Builder Engine (Weeks 4–5)**
The retrieval → assembly → dedup → prioritization → budgeting → render pipeline, built-in templates, the generate endpoint, copy + export. Ship the four headline generators (Business Advisor, Action Plan, Client Insight, Note Analysis).

**Phase 3 — Dashboard & Daily Action Center (Week 6)**
Aggregates, forecast, recommended actions, recent activity, prompt history and saved templates surfaced.

**Phase 4 — Polish & launch (Weeks 7–8)**
PDF export, onboarding flow with sample data, empty states, mobile responsiveness, error tracking, performance pass. Public MVP.

---

## 11. MVP Scope

**In scope:** single-user accounts; full client management with the standard field set; notes, tags, custom fields, attachments; status pipeline with Kanban and table; tasks/follow-ups and the Daily Action Center; rules-based dashboard and weighted forecast; the Prompt Builder Engine with the eight reusable templates (Business Advisor, Weekly Planning, Revenue Analysis, Client Review, Proposal Strategy, Follow-Up Recommendations, Meeting Analysis, Lead Qualification); the four headline generators; copy + TXT/Markdown/PDF export; prompt history and saved templates; CSV import.

**Explicitly out of MVP:** any direct AI API integration; multi-user/team features; email or calendar sync; automated outbound messaging; mobile native apps; semantic/vector search; billing/subscription tiers (add once product-market fit is shown).

---

## 12. Future Enhancement Roadmap

- **Optional direct AI integration** — an `AIProvider` adapter so users can paste their own API key and get answers in-app (bring-your-own-key keeps costs on the user). The prompt engine already produces the exact input; only a thin call layer is added.
- **Semantic memory** — `pgvector` over notes and relationship summaries for "find similar past clients" and richer client memory.
- **Email & calendar sync** — turn sent emails and meetings into activity automatically, removing manual note entry.
- **Automated follow-up suggestions** — scheduled "recommended actions" digests.
- **Light multi-user** — a shared workspace for a 2–3 person agency, still avoiding enterprise permission complexity.
- **Mobile app** — React Native client reusing the same API.
- **Template marketplace** — community-shared prompt templates by niche (SEO, design, coaching).
- **Billing & tiers** — free tier (limited clients) and a pro tier (unlimited + AI integration).

---

## 13. Risks & Mitigations

| Risk                                                                       | Mitigation                                                                                                                                                                                                |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **The manual copy/paste step feels clunky** and users want answers in-app. | Make copy + deep-link to the chosen AI as frictionless as possible; ship the optional bring-your-own-key integration early in the post-MVP roadmap — the engine already produces the prompt.              |
| **Prompt quality varies across AI platforms.**                             | Templates use provider-agnostic structure (role, delimited data, explicit output schema, reasoning instructions) proven to transport well; add the thumbs up/down loop to tune templates with real usage. |
| **Token budgets / paste limits differ per model and change over time.**    | Budget is configurable in settings with sensible per-destination defaults; progressive compression guarantees a usable prompt even when context is large.                                                 |
| **Generated prompts could leak more client data than intended.**           | Prioritization + budgeting include only relevant records; `context_meta` shows the user exactly what was included; everything stays in the user's account with no third-party calls in MVP.               |
| **Single-developer maintenance burden.**                                   | Managed, integrated stack (Vercel + Supabase) minimizes ops; modular monolith stays simple; TypeScript end-to-end reduces bugs.                                                                           |
| **Empty-product cold start** (CRM is useless with no data).                | CSV import + seeded sample data + a fast add-client form so first value arrives in minutes.                                                                                                               |
| **Scope creep toward enterprise features.**                                | The non-goals list is a hard filter; default to the simpler option whenever a feature could go either way.                                                                                                |
| **Data loss / trust.**                                                     | Soft-delete (archive) for clients, confirmation on hard delete, managed-DB automated backups, and clear data-export so users own their data.                                                              |
| **Forecast perceived as inaccurate.**                                      | Forecast is a transparent, user-adjustable weighted formula — not a black box — so expectations stay calibrated.                                                                                          |

---

_PromptDesk treats the AI not as a dependency but as an interchangeable endpoint the user already pays for — and treats its own job as the thing no chatbot does well alone: owning, structuring, and intelligently compiling the operator's business context._
