import { z } from 'zod'
import { revalidatePath, revalidateTag } from 'next/cache'
import type { McpServer } from '@modelcontextprotocol/server'
import { createClient, setClientArchived, updateClient } from '@/lib/clients'
import { createNote } from '@/lib/notes'
import { NOTE_TYPES } from '@/lib/notes/types'
import { createProject } from '@/lib/projects'
import { createTask, updateTask } from '@/lib/tasks'
import { dashboardTag } from '@/lib/cache-tags'
import { toDateOnly, toIso } from './serialize'

/**
 * The tools that change things.
 *
 * ── Registered conditionally ─────────────────────────────────────────────────
 *
 * Nothing here is registered unless the token carried `canWrite`. A read-only
 * token does not merely get refused — these tools are absent from its
 * `tools/list`, so the model never learns they exist and never proposes one.
 * That is a better failure than an error message: there is nothing to argue
 * with and nothing to retry.
 *
 * ── Ownership ────────────────────────────────────────────────────────────────
 *
 * Every function called here already verifies ownership of the row it is about
 * to touch, and of any foreign key it is handed — `createNote` looks the client
 * up by `{ id, ownerId }`, `createTask` the project, `createProject` the
 * client. That matters more on this surface than on the read one: a write tool
 * that takes a `clientId` is exactly the "foreign key in a request body"
 * attack `lib/db/ownership.ts` was written for. The tools below add no
 * ownership logic of their own; they report what those checks return.
 *
 * ── Annotations ──────────────────────────────────────────────────────────────
 *
 * `destructiveHint` is set honestly: true where a call overwrites or hides
 * something that was already there, false where it only adds. Clients use it
 * to decide how loudly to confirm, so marking an overwrite as additive would
 * cost the user the one prompt that would have caught it.
 */

/**
 * Mirrors what the server actions do, so the web UI reflects an AI's change.
 *
 * ── `revalidateTag`, not `updateTag` ─────────────────────────────────────────
 *
 * The server actions in `lib/actions/` call `updateTag`, and copying them here
 * looked right and was not: `updateTag` throws outside a Server Action, and
 * these run in a Route Handler. Worse than a plain failure — the write had
 * already committed by the time it threw, so the tool reported an error for a
 * change that had actually happened, and a model would reasonably retry it.
 *
 * `revalidateTag(tag, 'max')` is the Route Handler equivalent. The `'max'`
 * profile marks the entry stale and serves it while refreshing, rather than
 * expiring it outright; that is a good fit here because the only tagged cache
 * is the dashboard aggregate, which already tolerates a 60-second window by
 * construction.
 */
function revalidateClient(ownerId: string, clientId?: string): void {
  revalidatePath('/clients')
  if (clientId) revalidatePath(`/clients/${clientId}`)
  // `revalidatePath` re-renders a route but does not evict `unstable_cache`
  // entries — the dashboard aggregates are keyed separately. See
  // lib/cache-tags.ts for why both calls are needed.
  revalidateTag(dashboardTag(ownerId), 'max')
}

function failed(message: string) {
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true as const,
  }
}

function done(summary: string, payload: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: summary }],
    structuredContent: payload,
  }
}

export function registerWriteTools(server: McpServer, ownerId: string): void {
  // ── log_note ───────────────────────────────────────────────────────────────

  server.registerTool(
    'log_note',
    {
      title: 'Log a note',
      description:
        'Record a call, meeting or note against a client. This also advances ' +
        "the client's last-contact date and refreshes their relationship " +
        'summary, so it is how you keep a client record current after talking ' +
        'to them.',
      annotations: {
        readOnlyHint: false,
        // Append-only: it adds a note, it never rewrites one.
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      inputSchema: z.object({
        clientId: z.string().uuid(),
        body: z.string().min(1).max(10_000).describe('What happened, in prose'),
        // The app's own note vocabulary, not a second copy of it.
        noteType: z.enum(NOTE_TYPES).optional().describe('Defaults to "note"'),
        occurredAt: z
          .string()
          .date()
          .optional()
          .describe('YYYY-MM-DD. Defaults to today.'),
      }),
    },
    async ({ clientId, body, noteType, occurredAt }) => {
      const note = await createNote(ownerId, clientId, {
        body,
        // The schema defaults this, but its parsed type is required, so the
        // default is applied here rather than passing undefined through.
        noteType: noteType ?? 'note',
        occurredAt,
      })
      if (!note) return failed(`No client with id ${clientId}.`)

      revalidateClient(ownerId, clientId)
      return done(`Logged a ${note.noteType} against the client.`, {
        id: note.id,
        clientId,
        noteType: note.noteType,
        occurredAt: toIso(note.occurredAt),
      })
    },
  )

  // ── update_client ──────────────────────────────────────────────────────────

  server.registerTool(
    'update_client',
    {
      title: 'Update a client',
      description:
        'Change details on an existing client. Only the fields you pass are ' +
        'touched; everything else is left alone. Passing an empty string for ' +
        'a date clears it.',
      annotations: {
        readOnlyHint: false,
        // Overwrites whatever was there. The client should confirm.
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
      inputSchema: z.object({
        clientId: z.string().uuid(),
        companyName: z.string().max(200).optional(),
        contactName: z.string().max(200).optional(),
        email: z.string().max(200).optional(),
        phone: z.string().max(200).optional(),
        website: z.string().max(200).optional(),
        address: z.string().max(5_000).optional(),
        industry: z.string().max(200).optional(),
        companySize: z.string().max(200).optional(),
        leadSource: z.string().max(200).optional(),
        painPoints: z.string().max(5_000).optional(),
        requirements: z.string().max(5_000).optional(),
        opportunityNotes: z.string().max(5_000).optional(),
        nextFollowupDate: z
          .union([z.string().date(), z.literal('')])
          .optional()
          .describe('YYYY-MM-DD, or an empty string to clear it'),
      }),
    },
    async ({ clientId, ...fields }) => {
      // Strip undefined so an omitted field is left alone rather than nulled.
      const patch = Object.fromEntries(
        Object.entries(fields).filter(([, v]) => v !== undefined),
      )
      if (Object.keys(patch).length === 0) {
        return failed('Nothing to update — pass at least one field to change.')
      }

      const updated = await updateClient(ownerId, clientId, patch)
      if (!updated) return failed(`No client with id ${clientId}.`)

      revalidateClient(ownerId, clientId)
      return done(`Updated ${Object.keys(patch).join(', ')}.`, {
        id: updated.id,
        updatedFields: Object.keys(patch),
      })
    },
  )

  // ── create_client ──────────────────────────────────────────────────────────

  server.registerTool(
    'create_client',
    {
      title: 'Create a client',
      description:
        'Add a new client. A new client with no projects and no recorded ' +
        'contact starts at the "lead" stage — stage is derived, not set.',
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      inputSchema: z.object({
        companyName: z.string().max(200).optional(),
        contactName: z.string().max(200).optional(),
        email: z.string().max(200).optional(),
        phone: z.string().max(200).optional(),
        website: z.string().max(200).optional(),
        industry: z.string().max(200).optional(),
        leadSource: z.string().max(200).optional(),
        painPoints: z.string().max(5_000).optional(),
        requirements: z.string().max(5_000).optional(),
        nextFollowupDate: z.string().date().optional(),
      }),
    },
    async (fields) => {
      if (!fields.companyName && !fields.contactName) {
        return failed('Give the client a company name or a contact name.')
      }

      const client = await createClient(ownerId, fields)

      revalidateClient(ownerId)
      return done(`Created client ${client.companyName ?? client.contactName}.`, {
        id: client.id,
        companyName: client.companyName,
        contactName: client.contactName,
      })
    },
  )

  // ── set_client_archived ────────────────────────────────────────────────────

  server.registerTool(
    'set_client_archived',
    {
      title: 'Archive or restore a client',
      description:
        'Archive a client to take them out of the pipeline, or restore one. ' +
        'Archiving is reversible, but it derives the client’s stage to ' +
        '"lost" and removes them from lists and prompts.',
      annotations: {
        readOnlyHint: false,
        // Reversible, but it hides the client everywhere. Worth a prompt.
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
      inputSchema: z.object({
        clientId: z.string().uuid(),
        archived: z.boolean().describe('true to archive, false to restore'),
      }),
    },
    async ({ clientId, archived }) => {
      const updated = await setClientArchived(ownerId, clientId, archived)
      if (!updated) return failed(`No client with id ${clientId}.`)

      revalidateClient(ownerId, clientId)
      return done(archived ? 'Client archived.' : 'Client restored.', {
        id: updated.id,
        isArchived: updated.isArchived,
      })
    },
  )

  // ── create_project ─────────────────────────────────────────────────────────

  server.registerTool(
    'create_project',
    {
      title: 'Create a project',
      description:
        'Add a project under a client. This is how work and money attach to ' +
        'a client — and because stage is derived from projects, a "proposed" ' +
        'project moves the client to "proposal out" and an "active" one moves ' +
        'them to "active".',
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      inputSchema: z.object({
        clientId: z.string().uuid(),
        title: z.string().min(1).max(200),
        status: z
          .enum(['proposed', 'active', 'completed', 'on_hold', 'cancelled'])
          .optional()
          .describe('Defaults to "active"'),
        budget: z.number().nonnegative().optional(),
        rate: z
          .number()
          .nonnegative()
          .optional()
          .describe("Defaults to the client's stored rate"),
      }),
    },
    async ({ clientId, title, status, budget, rate }) => {
      try {
        const project = await createProject(ownerId, {
          clientId,
          title,
          status,
          budget,
          rate,
        })

        revalidatePath('/projects')
        revalidateClient(ownerId, clientId)
        return done(`Created project "${project.title}".`, {
          id: project.id,
          clientId,
          title: project.title,
          status: project.status,
        })
      } catch (err) {
        // `createProject` throws rather than returning null when the client is
        // not this owner's — the one write path that does.
        if (err instanceof Error && err.message === 'Client not found') {
          return failed(`No client with id ${clientId}.`)
        }
        throw err
      }
    },
  )

  // ── create_task ────────────────────────────────────────────────────────────

  server.registerTool(
    'create_task',
    {
      title: 'Create a task',
      description:
        'Add a to-do against a project. Tasks hang off projects, not clients, ' +
        'so use list_projects or get_client_summary to find the project id.',
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
      inputSchema: z.object({
        projectId: z.string().uuid(),
        title: z.string().min(1).max(500),
        dueDate: z.string().date().optional().describe('YYYY-MM-DD'),
      }),
    },
    async ({ projectId, title, dueDate }) => {
      const task = await createTask(ownerId, { projectId, title, dueDate })
      // Null covers both "not yours" and "archived", which is not a valid
      // target for new work either.
      if (!task) {
        return failed(
          `No active project with id ${projectId}. An archived project cannot take new tasks.`,
        )
      }

      revalidatePath(`/projects/${projectId}`)
      revalidateTag(dashboardTag(ownerId), 'max')
      return done(`Created task "${task.title}".`, {
        id: task.id,
        projectId,
        title: task.title,
        dueDate: toDateOnly(task.dueDate),
      })
    },
  )

  // ── complete_task ──────────────────────────────────────────────────────────

  server.registerTool(
    'complete_task',
    {
      title: 'Complete or reopen a task',
      description: 'Mark a task done, or reopen one that was closed early.',
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      inputSchema: z.object({
        taskId: z.string().uuid(),
        isDone: z.boolean().optional().describe('Defaults to true'),
      }),
    },
    async ({ taskId, isDone }) => {
      const task = await updateTask(ownerId, taskId, { isDone: isDone ?? true })
      if (!task) return failed(`No task with id ${taskId}.`)

      revalidatePath(`/projects/${task.projectId}`)
      revalidateTag(dashboardTag(ownerId), 'max')
      return done(task.isDone ? 'Task completed.' : 'Task reopened.', {
        id: task.id,
        title: task.title,
        isDone: task.isDone,
      })
    },
  )
}
