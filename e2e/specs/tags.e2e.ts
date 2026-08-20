import { beforeEach, describe, expect, it } from 'vitest'
import { createUser, db, request, type TestUser } from '../harness/context'

/**
 * Tags, and the one thing about them that only a database can decide.
 *
 * The duplicate-label rule is a unique constraint, so the route's 409 depends
 * on Postgres raising an error that the domain layer turns into a message.
 * With Prisma mocked there is nothing to raise it, which is why the branch had
 * never actually run.
 */
describe('tags', () => {
  let user: TestUser

  beforeEach(async () => {
    user = await createUser()
  })

  it('creates one', async () => {
    const res = await request('/api/tags', {
      as: user,
      method: 'POST',
      body: { label: 'Retainer', color: 'blue' },
    })

    expect(res.status).toBe(201)
    expect(res.body.tag).toMatchObject({ label: 'Retainer', color: 'blue' })
  })

  it('defaults the colour when none is given', async () => {
    const res = await request('/api/tags', {
      as: user,
      method: 'POST',
      body: { label: 'Retainer' },
    })

    expect(res.status).toBe(201)
    expect(res.body.tag.color).toBe('gray')
  })

  it('refuses a second tag with the same label', async () => {
    await request('/api/tags', { as: user, method: 'POST', body: { label: 'Retainer' } })

    const res = await request('/api/tags', {
      as: user,
      method: 'POST',
      body: { label: 'Retainer' },
    })

    expect(res.status).toBe(409)
    const { rows } = await db.query('SELECT id FROM tags')
    expect(rows).toHaveLength(1)
  })

  /**
   * The constraint is per owner, not global — two freelancers both having a
   * "Retainer" tag is normal, and a unique index on the label alone would have
   * let one account's tags block another's.
   */
  it('lets a different account use the same label', async () => {
    const other = await createUser()
    await request('/api/tags', { as: user, method: 'POST', body: { label: 'Retainer' } })

    const res = await request('/api/tags', {
      as: other,
      method: 'POST',
      body: { label: 'Retainer' },
    })

    expect(res.status).toBe(201)
  })

  it('rejects an unknown colour', async () => {
    const res = await request('/api/tags', {
      as: user,
      method: 'POST',
      body: { label: 'Retainer', color: 'chartreuse' },
    })

    expect(res.status).toBe(400)
  })

  it('rejects an empty label', async () => {
    const res = await request('/api/tags', { as: user, method: 'POST', body: { label: '' } })

    expect(res.status).toBe(400)
  })

  it('attaches one to a client and lists it back', async () => {
    const tag = await request('/api/tags', {
      as: user,
      method: 'POST',
      body: { label: 'Retainer' },
    })
    const client = await request('/api/clients', {
      as: user,
      method: 'POST',
      body: { companyName: 'Northwind Traders' },
    })

    const attached = await request(`/api/clients/${client.body.client.id}/tags`, {
      as: user,
      method: 'POST',
      body: { tagId: tag.body.tag.id },
    })

    expect(attached.status).toBe(201)
    // The list filters on the label rather than the id, case-insensitively.
    const filtered = await request('/api/clients?tag=retainer', { as: user })
    expect(filtered.body.clients).toHaveLength(1)
  })

  it('shows an account only its own tags', async () => {
    const other = await createUser()
    await request('/api/tags', { as: other, method: 'POST', body: { label: 'Theirs' } })

    const res = await request('/api/tags', { as: user })

    expect(res.body.tags).toEqual([])
  })
})
