import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { inject } from 'vitest'
import { resetSql } from './database'
import { sessionCookie } from './session'

/**
 * What a test file talks to: the running app, and the database behind it.
 *
 * The database connection is here so that a test can arrange state the API has
 * no route for (a project, an invoice, a time entry) and can check what
 * actually landed in a column rather than trusting the response it just got
 * back. Assertions about behaviour go through HTTP; the connection is for
 * setting up and for looking underneath.
 */

export const appUrl = inject('appUrl')
export const supabaseUrl = inject('supabaseUrl')
export const databaseUrl = inject('databaseUrl')

export const db = new Pool({ connectionString: databaseUrl, max: 4 })

/** Empty every table. Runs before each test, so no test inherits another's rows. */
export async function reset(): Promise<void> {
  await db.query(resetSql())
}

export type TestUser = {
  id: string
  email: string
  /** A Cookie header that signs requests in as this user. */
  cookie: string
}

/**
 * A signed-up user.
 *
 * The insert goes into `auth.users`, which is where Supabase Auth puts one —
 * and the `on_auth_user_created` trigger is what creates the matching
 * `public.users` row that every foreign key points at. So this exercises the
 * trigger on the way to every other test, rather than working around it.
 */
export async function createUser(
  overrides: { email?: string; fullName?: string } = {},
): Promise<TestUser> {
  const id = randomUUID()
  const email = overrides.email ?? `user-${id.slice(0, 8)}@example.test`
  const fullName = overrides.fullName ?? 'Test User'

  await db.query(
    `INSERT INTO auth.users (id, email, raw_user_meta_data)
     VALUES ($1, $2, jsonb_build_object('full_name', $3::text))`,
    [id, email, fullName],
  )

  return { id, email, cookie: sessionCookie(supabaseUrl, id, email) }
}

/**
 * A project. Written directly because projects are created by server actions
 * rather than a route, and most tests want one only as something to point at.
 */
export async function seedProject(
  ownerId: string,
  clientId: string,
  title = 'Website rebuild',
): Promise<string> {
  const id = randomUUID()
  await db.query('INSERT INTO projects (id, owner_id, client_id, title) VALUES ($1, $2, $3, $4)', [
    id,
    ownerId,
    clientId,
    title,
  ])
  return id
}

/** A recorded payment. `source` and `category` are NOT NULL, hence the defaults. */
export async function seedTransaction(
  ownerId: string,
  fields: {
    clientId?: string | null
    projectId?: string | null
    amount?: number
    type?: 'income' | 'expense'
    category?: string
    description?: string
  } = {},
): Promise<string> {
  const id = randomUUID()
  await db.query(
    `INSERT INTO transactions
       (id, owner_id, client_id, project_id, source, type, category, amount, occurred_at, description)
     VALUES ($1, $2, $3, $4, 'manual', $5, $6, $7, now(), $8)`,
    [
      id,
      ownerId,
      fields.clientId ?? null,
      fields.projectId ?? null,
      fields.type ?? 'income',
      fields.category ?? 'consulting',
      fields.amount ?? 4200,
      fields.description ?? 'Milestone 1',
    ],
  )
  return id
}

/**
 * The built-in prompt templates, as `prisma/seed-templates.ts` installs them:
 * one row per template with a null owner, shared by every account.
 *
 * They are seeded at deploy rather than by a migration, so a database built
 * from migrations alone has none — and prompt generation, which resolves its
 * template from this table, cannot run without them.
 */
export async function seedBuiltInTemplates(): Promise<void> {
  const { BUILT_IN_TEMPLATES } = await import('@/lib/prompt-engine/templates')

  for (const template of BUILT_IN_TEMPLATES) {
    await db.query(
      `INSERT INTO prompt_templates (owner_id, key, name, description, body, scope, token_budget)
       VALUES (NULL, $1, $2, $3, $4, $5, $6)`,
      [
        template.key,
        template.name,
        template.description ?? null,
        template.body,
        template.scope,
        template.tokenBudget,
      ],
    )
  }
}

export type RequestOptions = {
  /** Send as this user. Omit for an unauthenticated request. */
  as?: TestUser
  method?: string
  body?: unknown
  headers?: Record<string, string>
  /** Follow redirects. Off by default, so the proxy's redirect is observable. */
  redirect?: RequestRedirect
}

/**
 * The default body type is `any` rather than `unknown` on purpose. A test
 * reads `res.body.client.id` from a response whose shape is the route's
 * concern, not the harness's; `unknown` would mean a cast at every assertion,
 * which reads worse and checks nothing. A test wanting the type can pass one:
 * `request<{ clients: Client[] }>('/api/clients')`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type ApiResponse<T = any> = {
  status: number
  headers: Headers
  /** The parsed JSON body, or undefined when the response had none. */
  body: T
  text: string
}

/** An HTTP request to the running app. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function request<T = any>(
  path: string,
  { as, method = 'GET', body, headers = {}, redirect = 'manual' }: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const res = await fetch(`${appUrl}${path}`, {
    method,
    redirect,
    headers: {
      ...(as ? { cookie: as.cookie } : {}),
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  const text = await res.text()
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    parsed = undefined
  }

  return { status: res.status, headers: res.headers, body: parsed as T, text }
}
