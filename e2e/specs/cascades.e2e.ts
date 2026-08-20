import { beforeEach, describe, expect, it } from 'vitest'
import {
  createUser,
  db,
  request,
  seedProject,
  seedTransaction,
  type TestUser,
} from '../harness/context'

/**
 * What deleting something takes with it.
 *
 * Referential behaviour is declared in schema.prisma and enforced by Postgres,
 * with nothing in between for a unit test to observe — so it was never tested,
 * and the database had quietly disagreed with the schema for months. Deleting
 * a client whose project had a single task returned a 500 and deleted nothing,
 * because `tasks.project_id` was NOT NULL behind a foreign key that tried to
 * null it. `20260820000000_repair_db_push_drift` reconciles the two; these
 * pin the outcome.
 *
 * The two rules being distinguished: work is disposable, money is not. Tasks
 * and time entries go when their project goes. A transaction stays, and merely
 * stops being attributed.
 */
describe('deleting', () => {
  let user: TestUser
  let clientId: string
  let projectId: string

  beforeEach(async () => {
    user = await createUser()

    const created = await request('/api/clients', {
      as: user,
      method: 'POST',
      body: { companyName: 'Northwind Traders' },
    })
    clientId = created.body.client.id

    projectId = await seedProject(user.id, clientId)
  })

  it('removes a client that has a project with work under it', async () => {
    const task = await request('/api/tasks', {
      as: user,
      method: 'POST',
      body: { projectId, title: 'Send the proposal' },
    })
    expect(task.status).toBe(201)

    await db.query(
      `INSERT INTO time_entries (owner_id, project_id, date, hours)
       VALUES ($1, $2, CURRENT_DATE, 2.5)`,
      [user.id, projectId],
    )

    const res = await request(`/api/clients/${clientId}`, { as: user, method: 'DELETE' })

    expect(res.status).toBe(204)
    for (const table of ['clients', 'projects', 'tasks', 'time_entries']) {
      const { rows } = await db.query(`SELECT id FROM ${table}`)
      expect(rows, `${table} should be empty`).toHaveLength(0)
    }
  })

  it('keeps the money when the project it paid for is deleted', async () => {
    await seedTransaction(user.id, { clientId, projectId, amount: 4200 })

    await db.query('DELETE FROM projects WHERE id = $1', [projectId])

    const { rows } = await db.query('SELECT amount, client_id, project_id FROM transactions')
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].amount)).toBe(4200)
    // Still attributed to the client; no longer to the work.
    expect(rows[0].client_id).toBe(clientId)
    expect(rows[0].project_id).toBeNull()
  })

  it('keeps the money when the client it came from is deleted', async () => {
    await seedTransaction(user.id, { clientId, amount: 4200 })

    const res = await request(`/api/clients/${clientId}`, { as: user, method: 'DELETE' })

    expect(res.status).toBe(204)
    const { rows } = await db.query('SELECT amount, client_id FROM transactions')
    expect(rows).toHaveLength(1)
    expect(rows[0].client_id).toBeNull()
  })

  it('takes everything with the account row when it goes', async () => {
    await request(`/api/clients/${clientId}/notes`, {
      as: user,
      method: 'POST',
      body: { body: 'Renewal is at risk' },
    })

    await db.query('DELETE FROM users WHERE id = $1', [user.id])

    for (const table of ['clients', 'projects', 'notes']) {
      const { rows } = await db.query(`SELECT id FROM ${table}`)
      expect(rows, `${table} should be empty`).toHaveLength(0)
    }
  })

  /**
   * Deleting the Supabase Auth user does not delete the app's copy.
   *
   * There is a trigger creating `public.users` when `auth.users` gains a row,
   * and nothing for the reverse — the two tables are joined by convention, not
   * by a foreign key, so Postgres has nothing to cascade along. Deleting an
   * account in Supabase therefore leaves every client, project and note behind,
   * owned by a user id that can no longer sign in.
   *
   * Pinned as it stands rather than asserted as correct: whether that data
   * should be removed, retained, or removed on a schedule is a decision, and
   * this is only here so the decision is made deliberately rather than
   * discovered.
   */
  it('leaves the app data behind when only the auth user is deleted', async () => {
    await db.query('DELETE FROM auth.users WHERE id = $1', [user.id])

    const { rows } = await db.query('SELECT id FROM clients')
    expect(rows).toHaveLength(1)
  })
})
