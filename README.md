# PromptDesk

An AI-assisted CRM for solo freelancers and small service businesses. PromptDesk manages clients and pipeline, and generates optimized prompts from your CRM data. It does **not** call any AI API — it produces copyable text that the user pastes into ChatGPT, Claude, or any other AI tool.

---

## Table of Contents

1. [What This App Does](#1-what-this-app-does)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Routes & Pages](#4-routes--pages)
5. [Database Schema](#5-database-schema)
6. [Library Modules](#6-library-modules)
7. [The Prompt Engine](#7-the-prompt-engine)
8. [Server Actions](#8-server-actions)
9. [Authentication & Security](#9-authentication--security)
10. [Components](#10-components)
11. [Testing](#11-testing)
12. [Configuration & Environment](#12-configuration--environment)
13. [Development Commands](#13-development-commands)

---

## 1. What This App Does

PromptDesk is a single-tenant CRM where each user account holds its own isolated workspace. Users can:

- **Manage clients** through a full pipeline (lead → contacted → proposal sent → negotiating → won/lost), with estimated deal values, contact dates, notes, tasks, file attachments, and tags.
- **Track activity** — every status change, note, and follow-up is logged in an activity feed.
- **Get daily action queues** — overdue follow-ups, hot leads by value, and clients going cold (no contact in 30+ days).
- **Generate AI prompts** — the core feature. The app assembles structured context from CRM data and renders it into a ready-to-paste prompt using a library of built-in templates (business advisor, revenue analysis, client insight, follow-up recommendations, etc.). The user copies the prompt and pastes it into any AI tool. No LLM calls are made by this app.
- **Manage prompt templates** — users can customize built-in templates or create their own with `{{placeholder}}` syntax.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router), TypeScript, React 19 |
| Styling | Tailwind CSS v4, shadcn/ui, Radix UI |
| Database | Supabase (PostgreSQL), Prisma ORM |
| Auth | Supabase Auth (email/password) |
| Storage | Supabase Storage (file attachments) |
| Testing | Vitest |
| Error Monitoring | Sentry |
| Deployment | Vercel |

---

## 3. Project Structure

```
promptdesk/
├── app/                    # Next.js App Router routes
│   ├── (auth)/             # Public auth routes (login, signup)
│   └── (app)/              # Protected app routes
│       ├── dashboard/
│       ├── clients/
│       ├── prompts/
│       ├── daily-actions/
│       ├── settings/
│       └── @modal/         # Parallel route for modal overlays
├── components/             # React components, organized by feature
│   ├── ui/                 # shadcn/ui primitives
│   ├── layout/             # Sidebar, topbar, nav
│   ├── clients/
│   ├── dashboard/
│   ├── prompts/
│   ├── daily-actions/
│   ├── settings/
│   └── onboarding/
├── lib/                    # All business/domain logic
│   ├── actions/            # Next.js server actions (mutations)
│   ├── auth.ts             # getOwnerId(), getCurrentUser()
│   ├── clients/            # Client CRUD, filters, serialization
│   ├── dashboard/          # Aggregates, activity feed
│   ├── daily-actions/      # Action queue queries
│   ├── db/                 # Prisma singleton client
│   ├── notes/              # Note CRUD + activity logging
│   ├── prompt-engine/      # Pure prompt pipeline (no I/O)
│   ├── prompts/            # Prompt generation orchestrator + retrieval
│   ├── relationship-summary/ # Pure client summary builder
│   ├── sample-data/        # Seed data for onboarding
│   ├── supabase/           # Supabase client wrappers
│   ├── tags/               # Tag CRUD + client-tag relations
│   ├── tasks/              # Task CRUD
│   └── users/              # User profile + settings
├── prisma/
│   ├── schema.prisma       # Database schema
│   └── migrations/         # Migration history
└── docs/
    └── spec.md             # Full product specification
```

---

## 4. Routes & Pages

The app uses two layout groups: `(auth)` for public pages and `(app)` for authenticated pages.

### Public Routes

| Route | Description |
|-------|-------------|
| `/login` | Email/password login via Supabase Auth |
| `/signup` | New account registration |

### Protected Routes (require auth)

#### `/dashboard`
Loads in parallel: aggregates, recent activities, prompt history, saved templates, recommended actions, user settings, and sample data flag. Displays stat cards (total leads, active clients, pipeline value), a pipeline stage chart, activity timeline, recommended daily actions, conversion rate, and prompt history widgets.

#### `/clients`
Client list with server-side filtering by status, tag, search query, staleness, and archived state. Supports table view and kanban view. Dates and Decimal values are serialized before passing to client components.

#### `/clients/new`
Create client form. Validates with Zod, calls `createClientAction`.

#### `/clients/[id]`
Full client record — contact info, pipeline status, notes, tasks, attachments, tags, activity feed, and a prompt generation panel. Also renders as a modal via the `@modal/(.)clients/[id]` parallel route when opened from the client list.

#### `/clients/[id]/edit`
Edit client form pre-populated with existing values.

#### `/prompts`
Three-tab layout:
- **Generate** — select template, optional objective, optional client scope → runs the prompt pipeline → shows rendered output with copy button and context metadata
- **History** — last 50 generated prompts with full rendered text, token count, and rating
- **Templates** — browse and edit built-in and custom templates

#### `/daily-actions`
Three action queues displayed as vertical lists, each up to 20 items: overdue follow-ups (sorted oldest first), hot leads (sorted by estimated value), and going cold (no contact in 30+ days, sorted most stale first). Each row links to the client and has a quick-action sheet.

#### `/settings`
User profile (name, business name/type, preferred AI tool), prompt token budget, tag manager, and CSV bulk import.

---

## 5. Database Schema

All business tables include `owner_id` (UUID FK to `User.id`). Every query is scoped by owner — the ID always comes from the session, never from user input.

### User
Stores the auth identity plus profile and settings.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK, matches Supabase Auth UID |
| email | String | Unique |
| fullName | String? | |
| businessName | String? | Used in prompt rendering |
| businessType | String? | Used in prompt rendering |
| defaultAi | String? | "ChatGPT", "Claude", etc. |
| settings | JSON | `{ onboardingDismissed?, sampleDataLoaded?, tokenBudget? }` |
| createdAt | DateTime | |

### Client
The core CRM record.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| ownerId | UUID | FK User, cascade delete |
| companyName | String? | |
| contactName | String? | |
| email, phone, website | String? | |
| industry, companySize, leadSource | String? | |
| status | String | `lead \| contacted \| proposal_sent \| negotiating \| won \| lost` |
| estimatedValue | Decimal(12,2)? | |
| projectType, painPoints, requirements, opportunityNotes | String? | |
| lastContactDate | DateTime? | Indexed. Updated automatically when notes are added. |
| nextFollowupDate | DateTime? | Indexed. Used by daily actions. |
| customFields | JSON | Extensible key-value pairs |
| isArchived | Boolean | Default false |
| isSampleData | Boolean | Marks onboarding seed data |
| relationshipSummary | String? | Auto-generated prose summary (~300 tokens) |
| summaryUpdatedAt | DateTime? | |
| searchVector | tsvector | GIN-indexed full-text search |
| createdAt, updatedAt | DateTime | |

Indexes: `(ownerId, status)`, `(ownerId, nextFollowupDate)`, `customFields` GIN, `searchVector` GIN.

### Note
Dated journal entries on a client.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| ownerId, clientId | UUID | FKs, cascade delete |
| body | String | Free text |
| noteType | String | `note \| call \| email \| meeting` |
| occurredAt | DateTime | User-specified date of the interaction |
| createdAt | DateTime | |

Index: `(clientId, occurredAt DESC)`.

### Activity
Immutable audit log. Created automatically by lib functions, never directly by users.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| ownerId | UUID | FK |
| clientId | UUID? | FK, nullable (some activities are global) |
| type | String | `status_changed \| note_added \| task_created \| ...` |
| detail | JSON | Type-specific payload |
| createdAt | DateTime | |

Indexes: `(ownerId, createdAt DESC)`, `(clientId, createdAt DESC)`.

### Task
A to-do item optionally linked to a client.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| ownerId, clientId | UUID | clientId nullable |
| title | String | |
| dueDate | Date? | |
| isDone | Boolean | Default false |
| createdAt | DateTime | |

### Tag + ClientTag
Tags are per-user color-labeled strings. `ClientTag` is the many-to-many junction.

| Column | Type | Notes |
|--------|------|-------|
| Tag.id | UUID | PK |
| Tag.ownerId | UUID | FK |
| Tag.label | String | Unique per owner |
| Tag.color | String | Hex color |
| ClientTag.clientId | UUID | Composite PK |
| ClientTag.tagId | UUID | Composite PK |

### Attachment
File metadata. Binary stored in Supabase Storage; this table holds the reference.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| ownerId, clientId | UUID | FKs |
| fileName | String | |
| storageKey | String | Path in Supabase Storage |
| mimeType | String | |
| sizeBytes | BigInt? | |
| createdAt | DateTime | |

### PromptTemplate
Both system defaults (`ownerId = null`) and user customizations.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| ownerId | UUID? | Null = built-in |
| key | String | Stable identifier e.g. `business_advisor` |
| name, description | String | Display |
| version | Int | Incremented on edit |
| body | String | Template text with `{{placeholders}}` |
| scope | String | `global \| client \| notes` |
| tokenBudget | Int | Default 4000 |
| isActive | Boolean | |

### GeneratedPrompt
History of every prompt the user has generated.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| ownerId | UUID | FK |
| templateId | UUID? | FK PromptTemplate (SetNull on delete) |
| templateKey | String | Preserved for history display |
| scope | String | |
| clientId | UUID? | Set for client/notes-scope prompts |
| renderedText | String | Final output the user copies |
| tokenCount | Int? | |
| contextMeta | JSON | Scoring metadata (see Prompt Engine section) |
| isSaved | Boolean | User-starred prompts |
| rating | Int? | `1 \| -1` |
| createdAt | DateTime | |

Index: `(ownerId, createdAt DESC)`.

---

## 6. Library Modules

All domain logic lives in `lib/`. Modules are designed to be pure and composable — no Next.js–specific I/O inside business functions.

### `lib/auth.ts`
- `getCurrentUser()` → Supabase Auth user or `null`
- `getOwnerId()` → string (throws if unauthenticated)

Called at the top of every server action and page. The returned UUID becomes the `ownerId` scoping every query.

### `lib/db/client.ts`
Singleton PrismaClient using a pg Pool adapter configured for Vercel's serverless environment. Uses `DATABASE_URL` (transaction pooler, pgBouncer) at runtime and `DIRECT_URL` for migrations.

### `lib/clients/`
- `createClient(ownerId, input)` — validates with Zod, inserts row
- `getClientById(ownerId, id)` — full record with notes, tasks, attachments, activities, tags
- `listClients(ownerId, filters)` — applies filter clauses from `filters.ts`, returns serialized list
- `updateClient(ownerId, id, input)` — ownership check then update
- `setClientArchived(ownerId, id, archived)` — soft archive/restore
- `deleteClient(ownerId, id)` — hard delete (cascades)
- `changeClientStatus(ownerId, id, newStatus)` — transactional: updates status + creates activity log entry, then triggers async relationship summary refresh
- `serialize.ts` — converts `Decimal` and `Date` fields to JSON-safe types before passing to client components

### `lib/notes/`
- `createNote(ownerId, clientId, input)` — inserts note, auto-advances `client.lastContactDate` if the note date is newer, creates activity log, triggers summary refresh
- `deleteNote(ownerId, noteId)` — deletes note, triggers summary refresh
- `listNotes(ownerId, clientId)` — ordered by `occurredAt DESC`

### `lib/tasks/`
Standard CRUD: `createTask`, `listTasks`, `updateTask`, `deleteTask`. Tasks can be global (no clientId) or client-scoped.

### `lib/tags/`
- `listTags(ownerId)` — includes `_count.clientTags` for display
- `createTag / updateTag / deleteTag` — owns-check on every write
- `attachTag / detachTag` — manages `ClientTag` junction rows (upsert/delete)

### `lib/dashboard/`
- `getDashboardAggregates(ownerId)` — single `groupBy` query over clients, returns counts and sums by status, pipeline value, conversion rate, and stage breakdown. Wrapped in `unstable_cache` (60s TTL).
- `getRecentActivities(ownerId)` — last 10 activities with client name
- `getRecentGeneratedPrompts(ownerId)` — last 5 generated prompts
- `getSavedTemplates(ownerId)` — built-in + user templates ordered by name

### `lib/daily-actions/`
- `getOverdueFollowUps(ownerId)` — `nextFollowupDate < today`, oldest first
- `getHotLeads(ownerId)` — lead/contacted status with `estimatedValue > 0`, sorted by value descending
- `getGoingCold(ownerId)` — no contact in 30+ days (non-won/lost), most stale first
- `getRecommendedActions(ownerId)` — runs all three queries in `Promise.all`, deduplicates by clientId, returns up to 5 items

### `lib/users/`
- `getUserSettings(ownerId)` → `UserSettings` JSON
- `updateUserProfile(ownerId, data)` — name, business name/type, preferred AI
- `updateUserSettings(ownerId, patch)` — merges patch into existing JSONB settings

### `lib/relationship-summary/`
- `buildRelationshipSummary(input, now?)` — **pure function**, no I/O. Generates a ~300-token prose summary of a client relationship including age, status path, key extracted facts (keyword-triggered + recency-weighted), and recent notes. Deduplicates near-duplicate facts using Jaccard similarity ≥ 0.5.
- `refreshClientSummary(ownerId, clientId)` — async trigger called after note/status mutations. Fetches raw data, runs `buildRelationshipSummary`, writes result to `client.relationshipSummary`.

### `lib/sample-data/`
- `loadSampleData(ownerId)` — creates a set of realistic seed clients, notes, tags, and tasks in a transaction. Marks rows with `isSampleData = true`.
- `clearSampleData(ownerId)` — deletes all rows where `isSampleData = true`
- `hasSampleData(ownerId)` → boolean

### `lib/prompts/`
Entry point for prompt generation (orchestrates retrieval + pure pipeline):
- `generatePrompt(ownerId, req: GenerateRequest)` → `GenerateResult`
  1. Looks up the template record
  2. Fetches user profile, raw CRM data, and user settings in `Promise.all`
  3. Calls `buildPrompt()` (the pure pipeline)
  4. Persists result to `GeneratedPrompt` table
  5. Returns `{text, tokenCount, contextMeta}`

- `retrieval.ts` — `fetchContext(ownerId, spec, clientId?)` fetches clients, notes, tasks, and activities from the DB according to the retrieval spec. Tasks and activities are fetched in parallel when both are requested.

---

## 7. The Prompt Engine

Located in `lib/prompt-engine/`. This is the signature feature of the app. It is a **pure, framework-free module** — no database access, no HTTP calls, no side effects. Pass data in, get a string out.

Entry: `lib/prompts/index.ts` → `generatePrompt()` → `lib/prompt-engine/pipeline.ts` → `buildPrompt(input)`.

### Pipeline Stages

#### Stage 1 — Normalize (`normalizer.ts`)
Converts raw Prisma records to engine-internal types (`EngineClient`, `EngineNote`, `EngineTask`, `EngineActivity`):
- Dates formatted as `"Jun 3, 2026"`
- Currency formatted as `"$2,500.00"` using user's locale/currency settings
- Each note body hashed (djb2) for deduplication
- Null fields handled gracefully

#### Stage 2 — Deduplicate (`deduplicator.ts`)
Removes duplicate notes before scoring to avoid over-representing repeated information:
- **Pass 1**: exact match via content hash
- **Pass 2**: near-duplicate via Jaccard word-set similarity ≥ 0.85
- When duplicates found, the newer note is kept; order is preserved

#### Stage 3 — Build Scorable Set (`context-builder.ts`)
Flattens clients, notes, tasks, and activities into a single typed list of `ScorableItem`. Builds lookup maps (`clientMap`, `noteMap`, etc.) keyed by ID for efficient cross-referencing during scoring.

#### Stage 4 — Score (`scorer.ts`)
Each item receives a composite relevance score (0–1):

```
score = w_recency   * recency
      + w_dealValue * dealValue          (clients only)
      + w_urgency   * stageUrgency       (clients only)
      + w_staleness * stalenessRisk      (clients only)
      + w_match     * objectiveMatch     (notes, tasks, activities)
      + w_client    * clientUrgency      (items tied to a client)
```

| Factor | Description |
|--------|-------------|
| **recency** | Exponential decay with 30-day half-life. 1.0 at 0 days, ~0.5 at 21 days, ~0 at 90+ days. |
| **dealValue** | Normalized by max value in the dataset. |
| **stageUrgency** | `negotiating=1.0`, `proposal_sent=0.75`, `contacted=0.5`, `lead=0.25`, `won/lost=0.0` |
| **stalenessRisk** | `1.0` if overdue follow-up. `0.8` if 30+ days no contact. Linear decay below 30 days. |
| **objectiveMatch** | Jaccard similarity between the user's objective and the item's text (lowercase alpha tokens, stop words removed). |
| **clientUrgency** | Inherits the stageUrgency of the item's parent client. |

Default weights: recency=0.30, dealValue=0.20, stageUrgency=0.20, stalenessRisk=0.10, objectiveMatch=0.15, clientUrgency=0.05.

Returns items sorted descending by score, with a breakdown of each component for transparency.

#### Stage 5 — Build Scored Items (`context-builder.ts`)
Attaches rendering layers to each scored item:
- `fullContent` — detailed markdown (all fields)
- `summaryContent` — condensed 1–2 line version
- `estimatedTokens` — `chars / 4` estimate used by the budgeter

#### Stage 6 — Pipeline Aggregate (`context-builder.ts`)
For global-scope prompts only. Computes a `PipelineAggregate`:
- `statusCounts` by stage
- `weightedPipelineValue` (sum of `estimatedValue × stage probability`: lead=0.10, contacted=0.25, proposal_sent=0.50, negotiating=0.75, won=1.0)
- `staleClientCount` (no contact in 30+ days)
- `overdueFollowUpCount`

#### Stage 7 — Apply Budget (`budgeter.ts`)
Greedy single-pass allocation against the token budget (default 4000 tokens):

```
for each item (descending score):
  if fullContent fits remaining budget  → include as "full",   deduct tokens
  else if summaryContent fits           → include as "summary", deduct tokens
  else                                  → omit, add to omittedSummary
```

Returns `{included[], omittedSummary[], totalTokens}`.

#### Stage 8 — Build Context Block (`context-builder.ts`)
Assembles the included items and omitted summary into a markdown-formatted `{{context_block}}` string:

```
## Your CRM Context

**Client:** Acme Corp | Stage: negotiating | Value: $12,000
  Recent note (Jun 1): Had a great call about final contract terms.
  Open task: Send revised SOW (due Jun 10)

**Client:** Bright Agency | Stage: proposal_sent | Value: $5,000
  ...

3 older notes omitted.

## Pipeline Summary
Active clients: 8 | Stale: 2 | Weighted value: $47,200
```

#### Stage 9 — Render (`renderer.ts`)
Substitutes all `{{placeholder}}` tokens in the template body:

| Placeholder | Resolved to |
|-------------|-------------|
| `{{business_name}}` | `user.businessName` |
| `{{business_type}}` | `user.businessType` |
| `{{today}}` | `"Jun 3, 2026"` |
| `{{objective}}` | User's typed objective (optional) |
| `{{context_block}}` | The assembled context block from Stage 8 |

Returns `{text, tokenCount, usedPlaceholders, missingPlaceholders}`.

#### Stage 10 — Build Context Metadata
Packs scoring metadata into `contextMeta` JSON for display in the UI's context panel:

```json
{
  "templateKey": "business_advisor",
  "templateVersion": 1,
  "objective": "identify stalled deals",
  "includedItems": [
    { "id": "...", "type": "client", "tier": "full", "score": 0.92, "label": "Acme Corp" }
  ],
  "omittedGroups": [
    { "type": "note", "count": 3, "label": "3 older notes omitted" }
  ],
  "deduplicatedNoteCount": 2,
  "totalCandidateCount": 45
}
```

### Built-in Templates

Located in `lib/prompt-engine/templates/`. Each template has a `scope` (`global`, `client`, or `notes`) and a `retrievalSpec` describing what data to fetch.

| Key | Scope | Description |
|-----|-------|-------------|
| `business_advisor` | global | High-level business and pipeline advice |
| `business_action_plan` | global | Weekly prioritized action plan |
| `weekly_planning` | global | Weekly client focus and task planning |
| `revenue_analysis` | global | Pipeline value analysis and revenue forecast |
| `client_review` | global | Full pipeline review across all clients |
| `client_insight` | client | Deep dive on a single client |
| `proposal_strategy` | client | Proposal and closing strategy for one client |
| `follow_up_recommendations` | client | Next-step recommendations for one client |
| `meeting_analysis` | notes | Analyze a set of meeting notes |
| `note_analysis` | notes | Extract themes and actions from notes |
| `lead_qualification` | client | Score and qualify a specific lead |

---

## 8. Server Actions

All mutations go through server actions in `lib/actions/`. Every action follows this pattern:

1. Call `getOwnerId()` — throws if unauthenticated, returns owner's UUID
2. Parse and validate input with Zod
3. Call the corresponding lib function (which scopes the query by `ownerId`)
4. Call `revalidatePath(...)` to bust the Next.js route cache
5. Return `{ success: true, data }` or `{ success: false, error: string }`

| File | Actions |
|------|---------|
| `lib/actions/clients.ts` | createClient, updateClient, deleteClient, setClientArchived, changeClientStatus |
| `lib/actions/notes.ts` | createNote, deleteNote |
| `lib/actions/tasks.ts` | createTask, updateTask, deleteTask |
| `lib/actions/tags.ts` | createTag, updateTag, deleteTag, attachTag, detachTag |
| `lib/actions/users.ts` | updateUserProfile, updateUserSettings, dismissOnboarding |
| `lib/actions/sample-data.ts` | loadSampleData, clearSampleData |
| `lib/actions/import.ts` | importClientsFromCsv |
| `lib/actions/daily-actions.ts` | markFollowUpComplete |
| `lib/actions/auth.ts` | signup, login, logout |

---

## 9. Authentication & Security

### Auth Flow

1. User submits login form → `lib/actions/auth.ts` → `supabase.auth.signInWithPassword()`
2. Supabase sets a session cookie (HttpOnly, scoped to origin)
3. Every subsequent request reads the cookie via `createClient()` from `lib/supabase/server.ts`
4. `getOwnerId()` calls `supabase.auth.getUser()` and returns `user.id`
5. Every lib function and server action calls `getOwnerId()` as the first step

### Owner Isolation

The `ownerId` is **always derived from the session** — it is never read from request parameters or body. Every Prisma query includes `where: { ownerId, ... }`. This means even if a user guesses another user's record ID, the query will return nothing or throw a not-found error.

### Supabase Clients

| File | Used for |
|------|---------|
| `lib/supabase/server.ts` | Server components, server actions, route handlers |
| `lib/supabase/client.ts` | Client components (browser) |
| `lib/supabase/admin.ts` | Admin operations with service role key (server only) |

### Row-Level Security

Supabase RLS is enabled with a deny-all default policy. Application-level `ownerId` scoping in Prisma queries provides the primary isolation layer.

---

## 10. Components

### Layout (`components/layout/`)
- `sidebar.tsx` — Navigation links, user info, responsive collapsible
- `topbar.tsx` — Page header with user menu
- `mobile-nav.tsx` — Bottom sheet navigation on small screens

### Client Components (`components/clients/`)
- `client-table.tsx` — Sortable list with status badges, tag chips, search and filter controls
- `client-form.tsx` — Create/edit form with all CRM fields
- `client-detail.tsx` — Tabbed detail view (overview, notes, tasks, attachments, activity)
- `status-badge.tsx` — Colored badge for pipeline status
- `kanban-board.tsx` — Drag-to-reorder card view grouped by status

### Dashboard Components (`components/dashboard/`)
- `stat-card.tsx` — Metric card with icon, value, subtext
- `pipeline-chart.tsx` — Visual breakdown of pipeline stages with counts and values
- `activity-feed.tsx` — Chronological activity timeline
- `recommended-actions.tsx` — Preview of the daily action queue
- `conversion-metric.tsx` — Win/loss ratio display
- `prompt-history.tsx` — Recent generated prompts widget
- `saved-templates.tsx` — Template quick-launch buttons

### Prompt Components (`components/prompts/`)
- `prompts-page-tabs.tsx` — Three-tab container (Generate, History, Templates)
- `prompt-generator-shell.tsx` — Template selector + objective input + generate button
- `prompt-result-panel.tsx` — Full rendered output with copy button, token count, and AI destination links
- `context-meta-panel.tsx` — Expandable panel showing which items were scored, included, or omitted and why
- `prompt-history-list.tsx` — Scrollable history list with search and filter
- `template-browser.tsx` — Card grid of available templates with metadata
- `template-editor-sheet.tsx` — Slide-over editor for customizing template body

### Settings Components (`components/settings/`)
- `account-settings-form.tsx` — Profile and AI preference fields
- `forecast-settings-form.tsx` — Token budget slider
- `tag-manager.tsx` — Inline CRUD for tags with color picker
- `csv-importer.tsx` — File upload with column mapping and import preview

### Onboarding Components (`components/onboarding/`)
- `welcome-banner.tsx` — First-run banner with "Load sample data" CTA
- `tour-provider.tsx` / `tour-context.tsx` — Context-based product tour state
- `tour-banner.tsx` — Step-by-step tour hint banners

---

## 11. Testing

Tests use **Vitest** and live in `__tests__/` subdirectories next to the code they cover.

```
lib/
├── prompt-engine/__tests__/
│   ├── scorer.test.ts       # Scoring formula: recency, urgency, objective match
│   └── renderer.test.ts     # Template placeholder substitution, token estimation
├── prompts/__tests__/
│   └── pipeline.test.ts     # Full end-to-end buildPrompt() integration test
└── relationship-summary/__tests__/
    └── summarizer.test.ts   # Summary generation, key fact extraction, dedup
```

**`scorer.test.ts`** — Verifies each scoring component (recency decay at 0/21/90 days, stage urgency mappings, Jaccard objective match, staleness risk). Confirms composite scores are sorted correctly.

**`renderer.test.ts`** — Verifies `{{placeholder}}` substitution, tracks `missingPlaceholders`, and confirms `estimateTokens` returns `Math.ceil(chars / 4)`.

**`pipeline.test.ts`** — Full pipeline integration test with a fixture dataset of 3 clients, several notes, tasks, and activities. Verifies the output text contains expected content, contextMeta is well-formed, and deduplication counts are accurate.

**`summarizer.test.ts`** — Tests the pure relationship summary builder: zero-note clients, status path truncation, keyword-triggered fact extraction, Jaccard dedup of near-duplicate facts, recency windowing.

Run all tests:
```bash
npm run test
```

Watch mode:
```bash
npm run test:watch
```

---

## 12. Configuration & Environment

### Required Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Database (Prisma)
DATABASE_URL=          # Transaction pooler URL (pgBouncer) — used at runtime
DIRECT_URL=            # Direct connection URL — used for migrations only

# App
NEXT_PUBLIC_APP_URL=   # e.g. https://yourapp.vercel.app

# Sentry (optional)
SENTRY_ORG=
SENTRY_PROJECT=
NEXT_PUBLIC_SENTRY_DSN=
```

### `next.config.ts`
- React Compiler enabled for automatic memoization
- Sentry webpack plugin for source map upload at build time

### `tsconfig.json`
- Path alias: `@/*` → `./` (project root)
- Strict mode enabled
- Target: ES2017

---

## 13. Development Commands

```bash
# Start dev server
npm run dev

# Production build
npm run build

# Lint
npm run lint

# Run tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run Prisma migrations
npx prisma migrate dev

# Open Prisma Studio (DB browser)
npx prisma studio

# Regenerate Prisma client after schema changes
npx prisma generate
```

---

## Key Architectural Decisions

**No LLM calls.** The app assembles context and renders templates entirely server-side. The user copies the output and pastes it into any AI tool. This keeps costs at zero and keeps user data off third-party LLM APIs.

**Pure prompt engine.** `lib/prompt-engine/` has no I/O. All database access is in `lib/prompts/retrieval.ts`. This makes the pipeline fast, fully testable without mocks, and easy to reason about.

**Single-tenant by design.** Every table has `owner_id`. The auth session is the only source of truth for which records belong to whom. There are no admin views, teams, or shared workspaces.

**Server actions for all mutations.** Thin, validated, cache-invalidating wrappers over lib functions. No REST endpoints for mutations.

**Serialization boundary.** Prisma returns `Decimal` and `Date` objects that are not JSON-serializable. `lib/clients/serialize.ts` converts these before they cross the server/client boundary, preventing runtime errors in client components.
