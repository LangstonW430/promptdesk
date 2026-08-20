import { beforeEach, describe, expect, it } from 'vitest'
import { createUser, db, request, seedProject, type TestUser } from '../harness/context'

/**
 * One account's data staying out of another's.
 *
 * `__tests__/lib/db/ownership.test.ts` covers this at the function boundary
 * with Prisma mocked, which proves the check is written but not that it is
 * reached. These go through the same door an attacker would: a real request,
 * with a real session for the wrong user, carrying a real id belonging to
 * somebody else.
 *
 * Two distinct failures are covered. Reading another account's row is the
 * obvious one. The other is writing a foreign key that points into it — the
 * ownership module's own comment explains why that is not merely untidy: the
 * invoice list and the public invoice page both render the joined client's
 * name, so an unchecked `clientId` is a way to read it.
 */
describe('account isolation', () => {
  let owner: TestUser
  let intruder: TestUser
  let clientId: string
  let projectId: string

  beforeEach(async () => {
    owner = await createUser({ email: 'owner@example.test' })
    intruder = await createUser({ email: 'intruder@example.test' })

    const created = await request('/api/clients', {
      as: owner,
      method: 'POST',
      body: { companyName: 'Northwind Traders', email: 'ada@northwind.test' },
    })
    clientId = created.body.client.id

    // Projects have no route of their own — they are written by server actions
    // — so this one is seeded directly. It exists to be pointed at.
    projectId = await seedProject(owner.id, clientId)
  })

  describe('reading', () => {
    it('hides another account/s client behind a 404, not a 403', async () => {
      const res = await request(`/api/clients/${clientId}`, { as: intruder })

      // 404 rather than 403 on purpose: 403 would confirm the id exists.
      expect(res.status).toBe(404)
      expect(res.text).not.toContain('Northwind')
    })

    it('keeps another account/s clients out of the list', async () => {
      const res = await request('/api/clients', { as: intruder })

      expect(res.status).toBe(200)
      expect(res.body.clients).toEqual([])
    })

    it('keeps another account/s notes out of reach', async () => {
      const written = await request(`/api/clients/${clientId}/notes`, {
        as: owner,
        method: 'POST',
        body: { body: 'Renewal is at risk' },
      })
      expect(written.status).toBe(201)

      const res = await request(`/api/clients/${clientId}/notes`, { as: intruder })

      expect(res.body.notes).toEqual([])
      expect(res.text).not.toContain('Renewal is at risk')
    })

    it('keeps another account/s tasks out of the list', async () => {
      const written = await request('/api/tasks', {
        as: owner,
        method: 'POST',
        body: { projectId, title: 'Send the proposal' },
      })
      expect(written.status).toBe(201)

      const res = await request('/api/tasks', { as: intruder })

      expect(res.body.tasks).toEqual([])
    })

    it('keeps another account/s dashboard figures out of the totals', async () => {
      const res = await request('/api/dashboard', { as: intruder })

      expect(res.status).toBe(200)
      expect(JSON.stringify(res.body)).not.toContain('Northwind')
    })
  })

  describe('writing', () => {
    it('refuses to update another account/s client', async () => {
      const res = await request(`/api/clients/${clientId}`, {
        as: intruder,
        method: 'PATCH',
        body: { companyName: 'Taken over' },
      })

      expect(res.status).toBe(404)
      const { rows } = await db.query('SELECT company_name FROM clients WHERE id = $1', [clientId])
      expect(rows[0].company_name).toBe('Northwind Traders')
    })

    it('refuses to delete another account/s client', async () => {
      const res = await request(`/api/clients/${clientId}`, { as: intruder, method: 'DELETE' })

      expect(res.status).toBe(404)
      const { rows } = await db.query('SELECT id FROM clients WHERE id = $1', [clientId])
      expect(rows).toHaveLength(1)
    })

    it('refuses to archive another account/s client', async () => {
      const res = await request(`/api/clients/${clientId}/archive`, {
        as: intruder,
        method: 'POST',
        body: { archived: true },
      })

      expect(res.status).toBe(404)
    })

    /**
     * The foreign-key case. Nothing about this request is malformed — the body
     * validates, and the intruder is writing a note they are entitled to write.
     * Only the `clientId` in the path belongs to somebody else.
     */
    it('refuses to hang a note off another account/s client', async () => {
      const res = await request(`/api/clients/${clientId}/notes`, {
        as: intruder,
        method: 'POST',
        body: { body: 'Planted' },
      })

      expect(res.status).toBe(404)
      const { rows } = await db.query('SELECT id FROM notes')
      expect(rows).toHaveLength(0)
    })

    it('refuses to hang a task off another account/s project', async () => {
      const res = await request('/api/tasks', {
        as: intruder,
        method: 'POST',
        body: { projectId, title: 'Planted' },
      })

      expect(res.status).toBe(404)
      const { rows } = await db.query('SELECT id FROM tasks')
      expect(rows).toHaveLength(0)
    })

    it('refuses to attach another account/s tag to a client', async () => {
      const tag = await request('/api/tags', {
        as: owner,
        method: 'POST',
        body: { label: 'Retainer', color: 'blue' },
      })
      const intruderClient = await request('/api/clients', {
        as: intruder,
        method: 'POST',
        body: { companyName: 'Intruder Ltd' },
      })

      const res = await request(`/api/clients/${intruderClient.body.client.id}/tags`, {
        as: intruder,
        method: 'POST',
        body: { tagId: tag.body.tag.id },
      })

      expect(res.status).toBe(404)
      const { rows } = await db.query('SELECT * FROM client_tags')
      expect(rows).toHaveLength(0)
    })

    it('refuses to edit another account/s task', async () => {
      const task = await request('/api/tasks', {
        as: owner,
        method: 'POST',
        body: { projectId, title: 'Send the proposal' },
      })

      const res = await request(`/api/tasks/${task.body.task.id}`, {
        as: intruder,
        method: 'PATCH',
        body: { isDone: true },
      })

      expect(res.status).toBe(404)
      const { rows } = await db.query('SELECT is_done FROM tasks WHERE id = $1', [
        task.body.task.id,
      ])
      expect(rows[0].is_done).toBe(false)
    })
  })

  /**
   * `ownerId` comes from the session and is never read from the request. This
   * is that claim tested directly: an id in the body naming somebody else is
   * ignored, not honoured.
   */
  it('ignores an owner id supplied in the request body', async () => {
    const res = await request('/api/clients', {
      as: intruder,
      method: 'POST',
      body: { companyName: 'Planted', ownerId: owner.id, owner_id: owner.id },
    })

    expect(res.status).toBe(201)
    const { rows } = await db.query('SELECT owner_id FROM clients WHERE company_name = $1', [
      'Planted',
    ])
    expect(rows[0].owner_id).toBe(intruder.id)
  })
})
