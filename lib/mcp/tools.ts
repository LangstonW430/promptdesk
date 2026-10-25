import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/server'
import { getClientById, listClientsForTable } from '@/lib/clients'
import { CLIENT_STAGES, CLIENT_STAGE_LABELS, type ClientStage } from '@/lib/clients/stage'
import { clientStagesFor } from '@/lib/clients/stage-query'
import { countTasks, listTasksWithContext } from '@/lib/tasks'
import { TASK_STATUSES } from '@/lib/tasks/validators'
import { listProjects } from '@/lib/projects'
import { projectFinancials } from '@/lib/projects/financials'
import { invoiceTotalsForClient } from '@/lib/invoices'
import { MCP_LIMITS } from './config'
import { toDateOnly, toIso } from './serialize'

/**
 * The read-only tools.
 *
 * ── Owner scoping ────────────────────────────────────────────────────────────
 *
 * `ownerId` is an argument to `registerTools`, closed over by every handler.
 * No tool takes it as an input, and none *can*: it is not in any of the zod
 * schemas below, so there is nothing for a caller to supply and nothing for a
 * handler to read. The rule is enforced by the shape of the code rather than
 * by remembering to check, which matters because this is the control standing
 * between two accounts' data.
 *
 * ── Shape of a result ────────────────────────────────────────────────────────
 *
 * Each handler returns the JSON as both `structuredContent` (for clients that
 * can read it) and a pretty-printed `text` block (for models reading the
 * transcript). `isError: true` with a plain sentence is how "no such client"
 * is reported — a thrown Prisma error would reach the client as an opaque
 * protocol failure, and a model cannot act on that.
 */

/** A not-found (or otherwise expected) failure, in the form a model can read. */
function notFound(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true as const,
  }
}

/** A successful result, carried both ways. */
function ok(payload: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload as Record<string, unknown>,
  }
}

/** Company name, falling back to the contact — the same rule the UI uses. */
function displayName(
  client: { companyName: string | null; contactName: string | null },
): string {
  return client.companyName ?? client.contactName ?? 'Unnamed client'
}

export function registerTools(server: McpServer, ownerId: string): void {
  // ── search_clients ─────────────────────────────────────────────────────────

  server.registerTool(
    'search_clients',
    {
      title: 'Search clients',
      description:
        'Find clients by name, contact or email, optionally narrowed by ' +
        'pipeline stage, tag, or how long since last contact. Returns a ' +
        'summary row per client including the derived stage and the value of ' +
        'their open projects.',
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: z.object({
        q: z
          .string()
          .max(200)
          .optional()
          .describe('Case-insensitive substring of company name, contact name or email'),
        stage: z
          .enum(CLIENT_STAGES)
          .optional()
          .describe(
            'Derived pipeline stage. Computed from the client\'s projects and ' +
              'contact history, not stored on the client.',
          ),
        tag: z.string().max(100).optional().describe('Tag label, case-insensitive'),
        staleDays: z
          .number()
          .int()
          .min(1)
          .max(3650)
          .optional()
          .describe('Only clients with no contact in this many days, and still in open stages'),
        includeArchived: z.boolean().optional().describe('Defaults to false'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MCP_LIMITS.clients.max)
          .optional()
          .describe(`Defaults to ${MCP_LIMITS.clients.default}`),
      }),
    },
    async ({ q, stage, tag, staleDays, includeArchived, limit }) => {
      // The query behind this is unbounded and the limit is applied after it.
      // That is not an oversight: `stage` and `stale` are rules over projects
      // and notes rather than columns, so `listClientsForTable` filters them in
      // JS after fetching. A `take` in the query would be applied *before* that
      // filter and would return fewer than `limit` matching rows while
      // reporting a full page — a wrong answer rather than a slow one. The cap
      // that matters here is the one on what reaches the model, and that is the
      // slice below.
      const rows = await listClientsForTable(ownerId, {
        q,
        stage,
        tag,
        stale: staleDays,
        archived: includeArchived ?? false,
      })

      const take = limit ?? MCP_LIMITS.clients.default
      const clients = rows.slice(0, take).map((row) => ({
        id: row.id,
        name: displayName(row),
        contactName: row.contactName,
        email: row.email,
        industry: row.industry,
        stage: row.stage,
        stageLabel: CLIENT_STAGE_LABELS[row.stage as ClientStage],
        // Already summed to a number by `pipelineValueByClient`, so it stays
        // one. Absent means nobody has quoted this client yet, which is not
        // the same as zero — see lib/clients/pipeline-value.ts.
        pipelineValue: row.pipelineValue,
        lastContactDate: toDateOnly(row.lastContactDate),
        nextFollowupDate: toDateOnly(row.nextFollowupDate),
        tags: row.clientTags.map((ct) => ct.tag.label),
      }))

      return ok({
        clients,
        total: rows.length,
        truncated: rows.length > clients.length,
      })
    },
  )

  // ── get_client_summary ─────────────────────────────────────────────────────

  server.registerTool(
    'get_client_summary',
    {
      title: 'Get client summary',
      description:
        'Everything known about one client: profile, derived stage, projects, ' +
        'recent notes, open tasks, and the rolling relationship summary. This ' +
        'is the context the app compiles into its prompts.',
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: z.object({
        clientId: z.string().uuid().describe('The client id, as returned by search_clients'),
      }),
    },
    async ({ clientId }) => {
      const client = await getClientById(ownerId, clientId)
      if (!client) return notFound(`No client with id ${clientId}.`)

      const stages = await clientStagesFor(ownerId, [clientId])
      const stage = stages.get(clientId) ?? 'lead'

      return ok({
        id: client.id,
        name: displayName(client),
        stage,
        stageLabel: CLIENT_STAGE_LABELS[stage],
        contactName: client.contactName,
        email: client.email,
        phone: client.phone,
        website: client.website,
        address: client.address,
        industry: client.industry,
        companySize: client.companySize,
        leadSource: client.leadSource,
        painPoints: client.painPoints,
        requirements: client.requirements,
        opportunityNotes: client.opportunityNotes,
        // The engine's own compressed history of the relationship. Months of
        // notes already distilled — see lib/relationship-summary.
        relationshipSummary: client.relationshipSummary,
        isArchived: client.isArchived,
        lastContactDate: toDateOnly(client.lastContactDate),
        nextFollowupDate: toDateOnly(client.nextFollowupDate),
        createdAt: toIso(client.createdAt),
        updatedAt: toIso(client.updatedAt),
        tags: client.clientTags.map((ct) => ct.tag.label),
        projects: client.projects.slice(0, MCP_LIMITS.projectsPerClient).map((p) => ({
          id: p.id,
          title: p.title,
          status: p.status,
          budget: p.budget == null ? null : p.budget.toString(),
        })),
        // Capped well below the 50 the detail page loads: this lands in a
        // model's context window, and the relationship summary above already
        // carries the older history in compressed form.
        recentNotes: client.notes.slice(0, MCP_LIMITS.notesPerClient).map((n) => ({
          id: n.id,
          body: n.body,
          noteType: n.noteType,
          occurredAt: toIso(n.occurredAt),
        })),
        customFields: client.customFields,
      })
    },
  )

  // ── list_tasks ────────────────────────────────────────────────────────────

  server.registerTool(
    'list_tasks',
    {
      title: 'List tasks',
      description:
        'Outstanding or completed work, optionally narrowed to one client or ' +
        'project, or to what is due today or overdue. Each task names the ' +
        'project and client it belongs to.',
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: z.object({
        clientId: z
          .string()
          .uuid()
          .optional()
          .describe('Tasks on any of this client\'s projects'),
        projectId: z.string().uuid().optional(),
        status: z
          .enum(TASK_STATUSES)
          .optional()
          .describe('Defaults to "open"'),
        due: z
          .enum(['today', 'overdue'])
          .optional()
          .describe('Narrow to tasks due today, or already past their due date'),
        limit: z
          .number()
          .int()
          .min(1)
          .max(MCP_LIMITS.tasks.max)
          .optional()
          .describe(`Defaults to ${MCP_LIMITS.tasks.default}`),
      })
        // `due` means "open and past this date" — it has always implied
        // `isDone: false`, and the REST route depends on that. Combined with
        // `status: "done"` it asks for work that is both finished and
        // outstanding, which would come back as a confidently empty list. Said
        // out loud here, with the fix in the message, rather than answered
        // with nothing.
        .refine((v) => !(v.due && v.status === 'done'), {
          message:
            'due filters only match outstanding work; drop `status` or set it to "open"',
        }),
    },
    async ({ clientId, projectId, status, due, limit }) => {
      const filters = {
        clientId,
        projectId,
        status: status ?? ('open' as const),
        due,
      }
      const take = limit ?? MCP_LIMITS.tasks.default

      const [rows, total] = await Promise.all([
        listTasksWithContext(ownerId, { ...filters, limit: take }),
        countTasks(ownerId, filters),
      ])

      return ok({
        tasks: rows.map((t) => ({
          id: t.id,
          title: t.title,
          dueDate: toDateOnly(t.dueDate),
          isDone: t.isDone,
          createdAt: toIso(t.createdAt),
          projectId: t.project.id,
          projectTitle: t.project.title,
          projectStatus: t.project.status,
          clientId: t.project.client.id,
          clientName: displayName(t.project.client),
        })),
        total,
        truncated: total > rows.length,
      })
    },
  )

  // ── get_client_financials ─────────────────────────────────────────────────

  server.registerTool(
    'get_client_financials',
    {
      title: 'Get client financials',
      description:
        'What one client has been quoted, paid and invoiced: a profit-and-loss ' +
        'breakdown per project plus invoice totals by status. Figures are ' +
        'computed server-side, so no arithmetic is needed to read them.',
      annotations: { readOnlyHint: true, openWorldHint: false },
      inputSchema: z.object({
        clientId: z.string().uuid(),
        includeArchived: z
          .boolean()
          .optional()
          .describe('Include archived projects. Defaults to false.'),
      }),
    },
    async ({ clientId, includeArchived }) => {
      const client = await getClientById(ownerId, clientId)
      if (!client) return notFound(`No client with id ${clientId}.`)

      const projects = await listProjects(ownerId, {
        clientId,
        archived: includeArchived ?? false,
      })
      const capped = projects.slice(0, MCP_LIMITS.projectsPerClient)

      // One aggregate per project rather than a single grouped query: that
      // reuses `projectFinancials`, which owns the rules for what counts
      // (visible transactions only, recurring charges at face value) and for
      // margin and budget-collected. Duplicating those here to save round
      // trips would be the trade going the wrong way — and the fan-out is
      // bounded by the project cap above, which for a solo operator's client
      // is almost always a handful.
      const [breakdown, invoiceTotals] = await Promise.all([
        Promise.all(
          capped.map(async (project) => ({
            projectId: project.id,
            title: project.title,
            status: project.status,
            totalHours: project.totalHours,
            billableAmount: project.billableAmount,
            // Already reduced to numbers by projectFinancials, which sums the
            // Decimals in JS. Restringifying would claim a precision these no
            // longer carry.
            ...(await projectFinancials(ownerId, project.id, project.budget)),
          })),
        ),
        invoiceTotalsForClient(ownerId, clientId),
      ])

      const totals = breakdown.reduce(
        (acc, p) => ({
          budget: acc.budget + (p.budget ?? 0),
          income: acc.income + p.income,
          expenses: acc.expenses + p.expenses,
          net: acc.net + p.net,
        }),
        { budget: 0, income: 0, expenses: 0, net: 0 },
      )

      return ok({
        clientId: client.id,
        clientName: displayName(client),
        currency: 'USD',
        projects: breakdown,
        totals,
        invoices: invoiceTotals,
        truncated: projects.length > capped.length,
      })
    },
  )
}
