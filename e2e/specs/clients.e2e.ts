import { describe, expect, it } from 'vitest'
import { createUser, db, request } from '../harness/context'

/**
 * A client, from created to deleted, over HTTP.
 *
 * The unit tests already cover the query builders and the derived stage. What
 * they cannot see is whether a POST body survives Zod, Prisma and Postgres
 * intact, and whether what comes back out of a later GET is what went in. That
 * is what this checks — including reading the row directly, because a response
 * echoing the object it was handed proves nothing about what was stored.
 */
describe('clients', () => {
  it('creates one, stores it against the right owner, and returns it', async () => {
    const user = await createUser()

    const created = await request('/api/clients', {
      as: user,
      method: 'POST',
      body: {
        companyName: 'Northwind Traders',
        contactName: 'Ada Bell',
        email: 'ada@northwind.test',
        lastContactDate: '2026-07-01',
      },
    })

    expect(created.status).toBe(201)
    expect(created.body.client).toMatchObject({
      companyName: 'Northwind Traders',
      contactName: 'Ada Bell',
      email: 'ada@northwind.test',
    })

    const { rows } = await db.query(
      'SELECT owner_id, company_name, last_contact_date FROM clients WHERE id = $1',
      [created.body.client.id],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].owner_id).toBe(user.id)
    expect(rows[0].company_name).toBe('Northwind Traders')
  })

  it('lists what was created, and nothing else', async () => {
    const user = await createUser()
    await request('/api/clients', {
      as: user,
      method: 'POST',
      body: { companyName: 'Northwind Traders' },
    })
    await request('/api/clients', {
      as: user,
      method: 'POST',
      body: { companyName: 'Contoso' },
    })

    const list = await request('/api/clients', { as: user })

    expect(list.status).toBe(200)
    expect(list.body.clients.map((c: { companyName: string }) => c.companyName).sort()).toEqual([
      'Contoso',
      'Northwind Traders',
    ])
  })

  it('searches by name', async () => {
    const user = await createUser()
    await request('/api/clients', {
      as: user,
      method: 'POST',
      body: { companyName: 'Northwind Traders' },
    })
    await request('/api/clients', { as: user, method: 'POST', body: { companyName: 'Contoso' } })

    const found = await request('/api/clients?q=northwind', { as: user })

    expect(found.status).toBe(200)
    expect(found.body.clients).toHaveLength(1)
    expect(found.body.clients[0].companyName).toBe('Northwind Traders')
  })

  it('updates one', async () => {
    const user = await createUser()
    const { body } = await request('/api/clients', {
      as: user,
      method: 'POST',
      body: { companyName: 'Northwind Traders' },
    })

    const patched = await request(`/api/clients/${body.client.id}`, {
      as: user,
      method: 'PATCH',
      body: { contactName: 'Grace Reed' },
    })

    expect(patched.status).toBe(200)
    expect(patched.body.client.contactName).toBe('Grace Reed')
    // The rest of the record is left alone.
    expect(patched.body.client.companyName).toBe('Northwind Traders')
  })

  it('deletes one', async () => {
    const user = await createUser()
    const { body } = await request('/api/clients', {
      as: user,
      method: 'POST',
      body: { companyName: 'Northwind Traders' },
    })

    const deleted = await request(`/api/clients/${body.client.id}`, {
      as: user,
      method: 'DELETE',
    })

    expect(deleted.status).toBe(204)
    expect((await request(`/api/clients/${body.client.id}`, { as: user })).status).toBe(404)
    const { rows } = await db.query('SELECT id FROM clients WHERE id = $1', [body.client.id])
    expect(rows).toHaveLength(0)
  })

  it('archives one, and keeps it out of the working list', async () => {
    const user = await createUser()
    const { body } = await request('/api/clients', {
      as: user,
      method: 'POST',
      body: { companyName: 'Northwind Traders' },
    })

    const archived = await request(`/api/clients/${body.client.id}/archive`, {
      as: user,
      method: 'POST',
      body: { archived: true },
    })

    expect(archived.status).toBe(200)
    expect((await request('/api/clients', { as: user })).body.clients).toHaveLength(0)
    expect((await request('/api/clients?archived=true', { as: user })).body.clients).toHaveLength(1)
  })

  it('rejects a malformed date rather than storing it', async () => {
    const user = await createUser()

    const res = await request('/api/clients', {
      as: user,
      method: 'POST',
      body: { companyName: 'Northwind Traders', lastContactDate: 'last tuesday' },
    })

    expect(res.status).toBe(400)
    const { rows } = await db.query('SELECT id FROM clients')
    expect(rows).toHaveLength(0)
  })

  it('rejects an unparseable filter rather than ignoring it', async () => {
    const user = await createUser()

    const res = await request('/api/clients?stale=nonsense', { as: user })

    expect(res.status).toBe(400)
  })

  it('404s an id that is not a client of this account', async () => {
    const user = await createUser()

    const res = await request('/api/clients/2ff1de8f-0000-4000-8000-000000000000', { as: user })

    expect(res.status).toBe(404)
  })
})
