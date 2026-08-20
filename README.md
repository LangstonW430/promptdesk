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
12. [End-to-End Tests](#12-end-to-end-tests)
13. [Configuration & Environment](#13-configuration--environment)
14. [Development Commands](#14-development-commands)

---

## 1. What This App Does

PromptDesk is a single-tenant CRM where each user account holds its own isolated workspace. Users can:

- **Manage clients** through a pipeline whose stage is *derived from their projects* rather than set by hand (lead → contacted → proposal out → active → past, with archived reading as lost). Clients carry contact dates, notes, tasks, file attachments, tags and a billing address.
- **Track activity** — every status change, note, and follow-up is logged in an activity feed.
- **Get daily action queues** — overdue follow-ups, hot leads by value, and clients going cold (no contact in 30+ days).
- **Generate AI prompts** — the core feature. The app assembles structured context from CRM data and renders it into a ready-to-paste prompt using a library of built-in templates (business advisor, revenue analysis, client insight, follow-up recommendations, etc.). The user copies the prompt and pastes it into any AI tool. No LLM calls are made by this app.
- **Manage prompt templates** — users can customize built-in templates or create their own with `{{placeholder}}` syntax.
- **Run projects** — the work itself, with budgets, hourly rates, deliverable checklists, and a per-project profit-and-loss showing what came in against what was quoted.
- **Track time** — a weekly timesheet and a running timer, per project, with billable/non-billable split. Unbilled entries turn straight into an invoice.
- **Invoice clients** — build the invoice from logged time or by hand, then Stripe raises it: it numbers the invoice, emails the client, hosts the page they pay on, renders the PDF and chases the payment. Paid invoices come back as income against the right client and project.
- **See the money** — income and expenses over a selectable period, with recurring charges projected forward, Stripe transactions synced in, and category and per-client breakdowns.

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
Three action queues displayed as vertical lists, each up to 20 items: overdue follow-ups (sorted oldest first), hot leads (sorted by pipeline value, summed from their open projects), and going cold (no contact in 30+ days and still at an open stage, most stale first). Each row links to the client and has a quick-action sheet.

#### `/projects`
Every piece of work, grouped by status (proposed, active, on hold, completed, cancelled) with inline status switching. A project carries a budget, an hourly rate, dated start/end, and a deliverables checklist.

#### `/projects/[id]`
One project: money (received, spent, net, margin, and how much of the budget has been collected), attached files, deliverables, logged time with a built-in timer, and tasks.

#### `/projects/new`, `/projects/[id]/edit`
Create and edit forms.

#### `/time`
Weekly timesheet across every project, with billable/non-billable split and per-entry rates. Unbilled billable entries can be selected and turned straight into an invoice.

#### `/invoices`
Invoice list with status filtering. `overdue` is derived at read time from the due date rather than stored.

#### `/invoices/[id]`
The invoice document alongside its actions: mark sent, mark paid, copy the client link, print, archive, delete. Warns when billing details a client would expect are missing. Also generates a cover-email prompt.

#### `/invoices/new`
Create an invoice by hand, or pre-populated from selected time entries.

#### `/finance`
Income and expenses over a selectable period. Stat cards, a trend chart with a cumulative toggle, category and per-client breakdowns, and a transaction table. Recurring charges are entered once and projected across the periods they apply to.

#### `/settings`
User profile (name, business name/type, preferred AI tool), billing details printed on invoices (address, phone, tax number, default payment terms), Stripe connection, prompt token budget, tag manager, and CSV bulk import.

### Public, unauthenticated

| Route | Description |
|-------|-------------|
| `/invoice/[publicToken]` | **Legacy.** The read-only record of an invoice raised before Stripe invoicing. Unguessable 24-byte token, `noindex`, 404s for drafts. Kept so links already in clients' inboxes still resolve; new invoices are hosted by Stripe. |
| `POST /api/webhooks/stripe/[endpointToken]` | Per-user endpoint. The token identifies the owner; the signature is verified against that user's own secret. |
| `POST /api/webhooks/stripe` | **Legacy** shared endpoint, verified against `STRIPE_WEBHOOK_SECRET`. Resolves an owner only when exactly one user has Stripe connected. |

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
| address | String? | Billing address, printed on their invoices |
| painPoints, requirements, opportunityNotes | String? | |
| status, estimatedValue, projectType, defaultRate | — | **Retained but unread.** See [Superseded columns](#superseded-columns). |
| lastContactDate | DateTime? | Indexed. Updated automatically when notes are added. |
| nextFollowupDate | DateTime? | Indexed. Used by daily actions. |
| customFields | JSON | Extensible key-value pairs |
| isArchived | Boolean | Default false |
| isSampleData | Boolean | Marks onboarding seed data |
| relationshipSummary | String? | Auto-generated prose summary (~300 tokens) |
| summaryUpdatedAt | DateTime? | |
| searchVector | tsvector | GIN-indexed full-text search |
| createdAt, updatedAt | DateTime | |

Indexes: `(ownerId, nextFollowupDate)`, `(ownerId, isArchived, updatedAt DESC)`, `customFields` GIN, `searchVector` GIN.

#### Superseded columns

Four columns are still on the table and read by nothing: `status`,
`estimatedValue`, `projectType` and `defaultRate`. Each was replaced by
something derived from the client's projects, and each is retained deliberately
rather than dropped:

| Column | Replaced by | Why it is still here |
|--------|-------------|----------------------|
| `status` | Derived stage — `lib/clients/stage.ts` | The only record of what each client had been set to. The derived stage reads differently for anyone whose status was never reflected in their projects. |
| `estimatedValue` | `projects.budget` | The backfill skipped clients that already had projects, to avoid double-counting; their old figure survives only here. |
| `projectType` | `projects.title` / `deliverables` | Free text with no structured equivalent to migrate into. |
| `defaultRate` | `projects.rate` | No screen ever wrote it, so any value present was set directly against the database. `createProject` still reads it as the starting rate for a client's first project. |

This is a deliberate two-phase migration: stop reading, verify the derived
figures against real data, then drop in a later migration. Each column carries
the same note in `schema.prisma` and in the migration that retired it.

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

### Project
A piece of work for a client. The client's pipeline stage is derived from these.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| ownerId, clientId | UUID | FKs |
| title | String | |
| status | String | `proposed \| active \| completed \| on_hold \| cancelled` |
| budget | Decimal(12,2)? | What the work was quoted at. Open budgets sum to the client's pipeline value. |
| rate | Decimal(10,2)? | Hourly rate for this engagement; seeds new time entries |
| startDate, endDate | Date? | |
| deliverables | JSON | String array, checkable on the project page |
| isArchived | Boolean | Visibility only — a separate axis from `status` |

`proposed` exists so an opportunity can carry a number before there is anything to deliver.

### TimeEntry
| Column | Type | Notes |
|--------|------|-------|
| ownerId, projectId | UUID | FKs. Time belongs to a project, never to a client directly. |
| date, hours, rate | | |
| isBillable | Boolean | |
| invoiceId | UUID? | Set when the entry is billed; re-asserted null on claim so two invoices cannot take the same entry |

### Invoice
A mirror of a Stripe invoice, not the invoice itself.

| Column | Type | Notes |
|--------|------|-------|
| ownerId | UUID | FK |
| clientId | UUID? | **Nullable.** An invoice raised in the Stripe dashboard may be billed to someone not in the CRM. `SET NULL` on client delete — removing a client must not erase the record of money they were billed |
| customerName, customerEmail | String? | Who Stripe says it is for, so an unattributed invoice still shows a name and can be matched later |
| projectId | UUID? | Which work was billed |
| stripeInvoiceId | String? | Unique. **Null identifies a legacy row** raised before the move — readable, but not sendable or payable |
| stripeCustomerId | String? | The customer billed, frozen at creation |
| number | String? | Stripe's number, assigned at finalization. Null while a draft |
| hostedInvoiceUrl | String? | Where the client pays. Replaces the public token page |
| invoicePdf | String? | Stripe's rendered PDF. Replaces the print stylesheet |
| invoiceNumber, publicToken | Int?, String? | **Legacy.** Our old counter and client link. Never written for new invoices |
| lineItems | JSON | Cached from Stripe for list rendering. Never authoritative |
| status | Enum | `draft \| open \| paid \| uncollectible \| void` — Stripe's lifecycle. `overdue` is *derived at read time* from an open invoice past its due date, and is not a status |
| issueDate | Date | From Stripe's `created` |
| dueDate | Date? | **Nullable.** Stripe invoices that charge automatically carry no due date — they are collected, not awaited. `isOverdue` is false for those |
| subtotal, tax, taxRate, total | Decimal | Amounts are Stripe's; `taxRate` is ours, stored so the document can say "Tax (8.5%)" |
| paymentTerms | String? | e.g. "Net 30", copied from the user's default and frozen at creation |
| purchaseOrder | String? | The client's reference, sent to Stripe as a custom field |
| transactionId | UUID? | The income row created when it was paid |

### Transaction
Income and expenses, whether entered by hand or synced from Stripe.

| Column | Type | Notes |
|--------|------|-------|
| ownerId | UUID | FK |
| type, amount, currency, category | | `income \| expense`; amount always positive, `type` carries the sign |
| occurredAt | DateTime | |
| clientId, projectId | UUID? | Both `SET NULL` on delete — removing a project must not delete the record of money |
| source | String | `manual \| stripe` |
| externalId, externalType | String? | Unique with `(ownerId, source)`. Charges key on their **payment intent** so a card payment cannot be counted twice. |
| isRecurring, frequency, recurrenceEndedAt | | A standing charge is entered once and projected forward, not re-entered monthly. Ending a recurrence is how a cancellation is recorded — un-ticking `isRecurring` would erase the charge from the months it did apply to |
| stripeSubscriptionId | String? | Which subscription billed the charge, so cancelling in Stripe can end the standing charge here |
| hiddenAt | DateTime? | The user took this row off their ledger. Excluded from every read path. Imported rows cannot be deleted — the next backfill re-imports them — so hiding is what the table offers instead |

### StripeSyncState
One row per owner: sync status, last backfill, last event, last error.

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
- `getHotLeads(ownerId)` — clients with a pipeline value above zero, summed from their open projects, sorted by value descending
- `getGoingCold(ownerId)` — no contact in 30+ days and still at an open stage (lead, contacted or proposal out), most stale first
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

### `lib/projects/`
- `index.ts` — CRUD, plus `listProjects` with per-project time totals aggregated in SQL
- `financials.ts` — what a project earned against its budget. Margin is net over *income*, not over budget: a budget is a quote, and dividing by it would report a margin on money nobody has paid.

### `lib/time-entries/`
Weekly timesheets, billable filtering, and the week-boundary helpers.

### `lib/invoices/`
Stripe is the system of record; the `invoices` table is a mirror holding what Stripe has never heard of — which client, which project, which time entries.

- `stripe-mapper.ts` — pure, unit-tested mapping both ways: money in cents, fractional hours against Stripe's integer quantities, a due date as a day count, Stripe's status narrowed to our enum.
- `stripe-invoices.ts` — every Stripe call. Never writes to our database.
- `index.ts` — creation (by hand or from time entries), send, refresh, void, and recording payment from the webhook.
- `serialize.ts` — including the read-time `isOverdue` derivation. Stripe has no overdue status, so it is a property of an open invoice past its due date rather than a value we store.

**Ordering rule: Stripe first, then the mirror.** If the mirror write fails after Stripe succeeded, the worst case is an orphaned draft in the Stripe dashboard — visible and harmless. The other order shows the user an invoice that does not exist and cannot be paid.

Creating from time entries claims those entries inside one transaction, re-asserting `invoiceId: null`, so two concurrent requests cannot bill the same work twice.

Rows with a null `stripeInvoiceId` predate the move. They stay readable as records but cannot be sent, paid or edited — there is nothing in Stripe to act on.

**Importing invoices raised in Stripe.** `importStripeInvoices` paginates `invoices.list` and upserts a mirror row per invoice, so anything created in the Stripe dashboard or by a subscription appears in the list and is manageable from it. It only ever writes the fields Stripe owns — `projectId`, `isArchived` and the time-entry links are untouched — which is what makes re-running it safe.

The client link uses two signals, in `lib/invoices/match-client.ts`: the Stripe customer id already recorded on a client (an established link, so it wins), then the billing email. When neither hits, the invoice is stored unattributed and shown with Stripe's own customer name plus a picker to link it by hand. Matching on an email **back-fills** `Client.stripeCustomerId`, so the next invoice for that person matches on the stronger signal. A client is never created from an invoice — the same rule `linkTransactionsByEmail` follows, for the same reason. A link is only ever filled in, never cleared, so a re-import cannot undo one you set by hand.

**What can be done to an invoice, and when.** Stripe's rules, not ours:

| Action | Valid when |
|---|---|
| Send / resend reminder (`sendInvoice`) | open |
| Mark paid out of band (`pay({paid_out_of_band})`) | open |
| Write off (`markUncollectible`) | open |
| Void (`voidInvoice`) | open |
| Delete (`invoices.del`) | draft only |
| Edit memo, footer, PO, due date (`invoices.update`) | draft + open |

Amounts and line items cannot be changed once an invoice is finalized. Stripe treats it as an issued financial document; the dashboard cannot do it either, and voids and reissues instead.

### `lib/finance/`
- `calc.ts` — pure period maths: period boundaries, recurring-charge expansion, category grouping. `occurrenceDates` is the single definition of when a standing charge applies, so the chart, the totals and the table cannot disagree.
- `series.ts` — chart buckets that follow the period selector
- `stripe-mapper.ts` — pure Stripe-object → transaction mapping
- `stripe-sync.ts` — all Stripe I/O: backfill and event processing
- `stripe-key.ts` — per-user AES-256-GCM key storage, and per-user webhook endpoint registration
- `webhook-handler.ts` — what a verified event does, shared by both webhook routes so they cannot drift
- `visibility.ts` — the single `hiddenAt: null` filter every read path spreads, so a row the user hid leaves the table, the totals, the chart and project P&L together

### `lib/db/ownership.ts`
`ownsClient` / `ownsProject`. Foreign keys arriving in a request body are exactly as untrusted as an owner id, and every create that accepts one checks it first.

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
| **stageUrgency** | `proposal_out=1.0`, `active=0.75`, `contacted=0.5`, `lead=0.25`, `past/lost=0.0` — a quote awaiting an answer is the most time-sensitive thing in the pipeline |
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
- `weightedPipelineValue` (sum of open project budgets × stage probability: lead=0.10, contacted=0.25, proposal_out=0.50, active=1.0, past/lost=0.0 — shared with the dashboard via `STAGE_PROBABILITY` so the two cannot disagree)
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

**Client:** Acme Corp | Stage: Proposal out | Value: $12,000
  Recent note (Jun 1): Had a great call about final contract terms.
  Open task: Send revised SOW (due Jun 10)

**Client:** Bright Agency | Stage: Active client | Value: $5,000
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

Tests use **Vitest**, and live either in `__tests__/` beside the code they cover
or under the top-level `__tests__/` directory. 30 files, 450 tests, under two
seconds. The end-to-end suite is separate — see
[section 12](#12-end-to-end-tests).

They concentrate on business logic rather than rendering: the prompt engine, the
finance and period maths, the derived client stage, project profitability, and
the ownership rules that keep one account's data out of another's. Database
access is mocked at the Prisma boundary, so a test asserts the *query* that was
built as often as the value returned — `buildClientWhere`, for instance, has a
test asserting that a stage condition never reaches SQL, because a stage is a
rule over projects rather than a column.

Two things are deliberately verified outside the suite, because a unit test
cannot see them:

- **Raw SQL and migrations** are run against [PGlite](https://pglite.dev) with
  fixtures covering each branch, then re-run with the logic broken to confirm
  the check actually fails. The end-to-end suite now does this continuously:
  it builds its database by replaying the migration history.
- **Rendering** is checked by bundling the real component and driving headless
  Chromium — including printing a dark-theme invoice to PDF and reading the
  colour operators back out of the content stream, to prove the sheet comes out
  black-on-white.

### A few worth pointing at

| File | What it pins down |
|------|-------------------|
| `lib/prompt-engine/__tests__/scorer.test.ts` | Each scoring component — recency decay at 0/21/90 days, stage urgency, Jaccard objective match, staleness — and that composites sort correctly |
| `lib/prompts/__tests__/pipeline.test.ts` | The whole prompt pipeline over a fixture of three clients with notes, tasks and activities, down to the rendered context block |
| `lib/finance/__tests__/future-dated.test.ts` | That the horizon stopping recurring charges being projected forward does not also hide a one-off dated next month |
| `__tests__/lib/clients/stage.test.ts` | Every branch of the derived client stage, the precedence between them, and that each stage is reachable |
| `__tests__/lib/db/ownership.test.ts` | That a foreign key from a request body is checked against the session owner before it is written |
| `__tests__/lib/invoices/derive-status.test.ts` | That an invoice due today is not yet overdue — a due date is a whole day, not an instant |

Run all tests:
```bash
npm run test
```

Watch mode:
```bash
npm run test:watch
```

---

## 12. End-to-End Tests

```bash
npm run test:e2e
```

Real HTTP requests, to the real application, against a real Postgres. Nothing
inside the app is mocked, stubbed or reconfigured: it is started the way
`npm run dev` starts it, reads `DATABASE_URL`, and is reached over a socket.
62 tests in about 70 seconds, and no Docker, no services and no credentials —
`npm run test:e2e` is the whole setup, on a laptop and in CI alike.

### How the stack comes up

```
  PGlite ──▶ stub Supabase Auth ──▶ Next.js dev server ──▶ tests
  (real Postgres,   (answers          (the app, started    (fetch + a
   over TCP)         getUser())        unmodified)          pg connection)
```

- **Postgres** is [PGlite](https://pglite.dev) — Postgres compiled to
  WebAssembly — put behind a TCP socket by `@electric-sql/pglite-socket`, so
  `pg`, Prisma and the Prisma CLI all connect to an ordinary `postgresql://`
  URL. The schema is built by **replaying every migration in order**, not by
  pushing `schema.prisma`, so a history that cannot build the database fails the
  suite before a single request is made.
- **Supabase Auth** is a ~120-line stub. `supabase.auth.getUser()` is an HTTP
  call to the Auth server, not a local JWT decode — that is exactly why it can
  be trusted server-side — so something has to answer it. What is faked is
  Supabase; cookie parsing, session validation, the proxy's redirect and every
  `getOwnerId()` call are the shipped code. Users are read from `auth.users`, so
  seeding a user is all it takes to sign in as them.
- **The app** runs in a child process on an assigned port, writing to
  `.next-e2e` so a test run cannot collide with a dev server. Dev mode rather
  than `build && start` because `NEXT_PUBLIC_*` values are inlined at compile
  time and these ports only exist at run time.

Tests hold a database connection alongside the HTTP client. Behaviour is
asserted through requests; the connection is for arranging what a route has no
API for, and for checking what actually landed in a column — a response echoing
the object it was handed proves nothing about what was stored.

### What it covers

| File | What it pins down |
|------|-------------------|
| `e2e/specs/isolation.e2e.ts` | One account's data staying out of another's — reads, writes, and foreign keys in a request body pointed at somebody else's row |
| `e2e/specs/auth-gate.e2e.ts` | The proxy redirect and `getOwnerId()`; expired sessions, deleted users, and cookies that are not sessions |
| `e2e/specs/migrations.e2e.ts` | That the migration history reproduces `schema.prisma` exactly, that the `auth.users` trigger fires, and that RLS covers every owned table |
| `e2e/specs/stripe-webhook.e2e.ts` | Genuine HMAC verification, per-user secrets, and that one account's event cannot touch another's invoice |
| `e2e/specs/cascades.e2e.ts` | What deleting something takes with it: work is disposable, money is not |
| `e2e/specs/clients.e2e.ts` | A client from created to deleted, and validation refusing to store what it rejects |
| `e2e/specs/prompts.e2e.ts` | Generation over real retrieval, with the client's own words in the output |
| `e2e/specs/tags.e2e.ts` | The duplicate-label 409, which is a unique constraint and so needs a database to raise it |

### What it found

Written to close a stated gap; it closed four defects on the way in, none of
which any unit test could have seen.

- **Stripe webhooks had never been reachable.** `/api/webhooks` was not in the
  proxy's public prefixes, so every delivery from Stripe — arriving, correctly,
  with no session — was redirected to `/login` and the handler never ran.
  Invoice status only ever moved when somebody pressed *Refresh from Stripe*.
- **`prisma migrate deploy` could not build the database.** No migration ever
  created the `invoices` table; it had been `db push`ed in June and the
  migration that enables RLS on it says so in a comment. A fresh deployment
  failed at that migration. `time_entries.invoice_id`, `transactions.frequency`
  and the `RecurringFrequency` enum were missing for the same reason.
- **Deleting a client with any work under it returned a 500.**
  `tasks.project_id` and `time_entries.project_id` were `ON DELETE SET NULL`
  behind columns a later migration made `NOT NULL`. `schema.prisma` had said
  `onDelete: Cascade` all along; only the database disagreed.
- **The proxy's prefetch optimisation is dead code.** Next strips every flight
  header, `next-router-prefetch` among them, before middleware runs, so the
  branch that skips the auth round-trip never executes. Harmless — it fails
  closed — but it is not saving the work its comment describes.

The drift check is the durable half of that: `prisma migrate diff` between the
migrated database and `schema.prisma` must come back empty, so a change that
reaches production by `db push` cannot go unrecorded again.

### Still not covered

Nothing drives a browser, so rendering, client-side state and server actions
reached through form submission are still only checked by hand. The suite goes
through the HTTP surface: route handlers, the proxy, and everything behind them.

---

## 13. Configuration & Environment

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

# Stripe (optional — required for revenue import and invoicing)
STRIPE_ENCRYPTION_KEY=    # 64 hex chars; encrypts per-user keys and webhook secrets
STRIPE_RESTRICTED_KEY=    # Fallback key when no per-user key is saved (rk_live_... / rk_test_...)
STRIPE_WEBHOOK_SECRET=    # Legacy shared-endpoint signing secret (whsec_...); per-user secrets live in the DB
STRIPE_API_VERSION=       # Pin: 2026-05-27.dahlia
```

### Stripe Setup

Stripe does two jobs here, and they need different permissions:

1. **Revenue import** (read-only) — charges, refunds and subscriptions become income and expense transactions.
2. **Invoicing** (read/write) — Stripe *is* the invoice system. It assigns the number, hosts the page the client pays on, renders the PDF, emails it and chases payment. PromptDesk keeps a mirror row linking each Stripe invoice to a client, project and time entries.

**Key type:** Use a [Restricted key](https://dashboard.stripe.com/apikeys) (`rk_live_...`), **not** the full secret key.

| Permission | Scope | Needed for |
|---|---|---|
| Charges, Balance transactions, Subscriptions | Read | Revenue import |
| Invoices, Customers, Tax Rates | Write | Raising and sending invoices |
| Webhook Endpoints | Write | Automatic status and payment updates |

A read-only key still works — transactions import as before, and Settings says plainly which features are unavailable rather than failing later at the moment you try to bill a client.

**Connecting without touching code:** Users paste their restricted key in **Settings → Stripe**. The key is encrypted with AES-256-GCM using `STRIPE_ENCRYPTION_KEY` before being stored in the database.

To enable this, generate a deployment-level encryption key once and add it to your environment:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# → set the output as STRIPE_ENCRYPTION_KEY in .env.local / Vercel env vars
```

`STRIPE_RESTRICTED_KEY` (env var) is optional — used only as a fallback when no per-user key is saved. Self-hosted single-user deployments can still use it directly.

**Security model:** The encryption key (`STRIPE_ENCRYPTION_KEY`) never touches the database. The Stripe key is encrypted with a fresh random IV per write. The last-4 chars are stored unencrypted for display only. Webhook signing secrets get identical treatment.

**Revenue recognition:** Income is recorded at the charge event. Payouts are the same money moving to your bank account and are intentionally excluded to prevent double-counting.

**PCI:** Only `last4` and `brand` are stored for display. Full card numbers and raw bank details are never persisted.

### Webhooks

Each user gets their **own endpoint**, registered against their own Stripe account when they save their key. It posts to `/api/webhooks/stripe/[token]`, where the token identifies the owner, and its signing secret is stored encrypted per user.

This replaced a single shared endpoint whose handler resolved the owner by picking whichever user had synced most recently — which could attribute one Stripe account's events to a different user. That mattered little while invoice payments carried an `ownerId` in their metadata, but Stripe now owns the invoice lifecycle and status arrives by webhook alone.

The token is **not** a credential. It selects which signing secret to verify against; nothing is trusted until that signature checks out.

Endpoint registration needs `NEXT_PUBLIC_APP_URL` set to a publicly reachable URL. Without one — or with a key lacking Webhook Endpoints: Write — invoicing still works, but statuses only update when you press **Refresh from Stripe** on an invoice.

`/api/webhooks/stripe` (no token) remains for endpoints configured before this change. It resolves an owner only when exactly one user has Stripe connected, and refuses rather than guessing otherwise.

**Handled events:** `charge.succeeded`, `charge.updated`, `charge.refunded`, `invoice.finalized`, `invoice.sent`, `invoice.updated`, `invoice.paid`, `invoice.payment_succeeded`, `invoice.payment_failed`, `invoice.voided`, `invoice.marked_uncollectible`, `customer.created`, `customer.updated`, `customer.subscription.updated`, `customer.subscription.deleted`.

**Security note:** Every inbound request is verified with HMAC-SHA256 (`Stripe.webhooks.constructEvent`). Requests with a missing or invalid `stripe-signature` header are rejected with `400` before any data is read or written. Tests live in `lib/finance/__tests__/webhook-signature.test.ts`.

### Testing Stripe webhooks locally

Stripe cannot reach `localhost`, so endpoint registration is skipped in local development. Use the [Stripe CLI](https://stripe.com/docs/stripe-cli) against the legacy shared route instead:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

The CLI prints a signing secret (`whsec_...`) — set it as `STRIPE_WEBHOOK_SECRET` in `.env.local`. Trigger a test event in another terminal:

```bash
stripe trigger invoice.paid
```

### `next.config.ts`
- React Compiler enabled for automatic memoization
- Sentry webpack plugin for source map upload at build time

### `tsconfig.json`
- Path alias: `@/*` → `./` (project root)
- Strict mode enabled
- Target: ES2017

---

## 14. Development Commands

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

# Run the end-to-end suite (starts its own Postgres, Auth stub and app server)
npm run test:e2e

# ...with the app server's own logs streamed, for debugging a failure
E2E_APP_LOGS=1 npm run test:e2e

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
