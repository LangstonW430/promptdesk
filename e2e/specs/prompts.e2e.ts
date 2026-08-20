import { beforeEach, describe, expect, it } from 'vitest'
import {
  createUser,
  db,
  request,
  seedBuiltInTemplates,
  type TestUser,
} from '../harness/context'

/**
 * Generating a prompt, end to end.
 *
 * `lib/prompts/__tests__/pipeline.test.ts` runs the same pipeline over a
 * fixture, which is the right place to pin scoring and budgeting. What it
 * cannot show is that the data reaching the pipeline is the data in the
 * database: retrieval, the owner scoping on every query behind it, template
 * resolution, and the row written afterwards.
 *
 * So these assert on the client's own words appearing in the rendered output.
 * A prompt that renders but contains none of the pipeline is a pass for the
 * unit test and a failure here.
 */
describe('prompt generation', () => {
  let user: TestUser

  beforeEach(async () => {
    await seedBuiltInTemplates()
    user = await createUser()
  })

  it('renders a prompt from what is actually in the account', async () => {
    const created = await request('/api/clients', {
      as: user,
      method: 'POST',
      body: { companyName: 'Northwind Traders', contactName: 'Ada Bell' },
    })
    await request(`/api/clients/${created.body.client.id}/notes`, {
      as: user,
      method: 'POST',
      body: { body: 'They want the migration finished before their audit.' },
    })

    const res = await request('/api/prompts/generate', {
      as: user,
      method: 'POST',
      body: { template_key: 'business_advisor', scope: 'global' },
    })

    expect(res.status).toBe(200)
    expect(res.body.text).toContain('Northwind Traders')
    expect(res.body.token_count).toBeGreaterThan(0)
  })

  it('does not put another account/s clients in the prompt', async () => {
    const other = await createUser()
    await request('/api/clients', {
      as: other,
      method: 'POST',
      body: { companyName: 'Northwind Traders' },
    })

    const res = await request('/api/prompts/generate', {
      as: user,
      method: 'POST',
      body: { template_key: 'business_advisor', scope: 'global' },
    })

    expect(res.status).toBe(200)
    expect(res.body.text).not.toContain('Northwind Traders')
  })

  it('404s a template that does not exist, rather than 500ing', async () => {
    const res = await request('/api/prompts/generate', {
      as: user,
      method: 'POST',
      body: { template_key: 'no-such-template', scope: 'global' },
    })

    expect(res.status).toBe(404)
  })

  it('refuses a client-scoped template with no client', async () => {
    const res = await request('/api/prompts/generate', {
      as: user,
      method: 'POST',
      body: { template_key: 'client_review', scope: 'client' },
    })

    expect(res.status).toBe(400)
    expect(res.body.error).toContain('client_id')
  })

  it('refuses a body that is not JSON', async () => {
    const res = await request('/api/prompts/generate', {
      as: user,
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: undefined,
    })

    expect(res.status).toBe(400)
  })

  it('will not generate against another account/s client', async () => {
    const other = await createUser()
    const theirs = await request('/api/clients', {
      as: other,
      method: 'POST',
      body: { companyName: 'Northwind Traders' },
    })

    const res = await request('/api/prompts/generate', {
      as: user,
      method: 'POST',
      body: {
        template_key: 'client_review',
        scope: 'client',
        client_id: theirs.body.client.id,
      },
    })

    // However it refuses, it must not render their client into the output.
    expect(res.body?.text ?? '').not.toContain('Northwind Traders')
  })

  it('keeps a record of what was generated, against the right owner', async () => {
    await request('/api/clients', {
      as: user,
      method: 'POST',
      body: { companyName: 'Northwind Traders' },
    })

    await request('/api/prompts/generate', {
      as: user,
      method: 'POST',
      body: { template_key: 'business_advisor', scope: 'global' },
    })

    const { rows } = await db.query('SELECT owner_id FROM generated_prompts')
    expect(rows).toHaveLength(1)
    expect(rows[0].owner_id).toBe(user.id)

    const history = await request('/api/prompts/history', { as: user })
    expect(history.status).toBe(200)
    expect(history.body.prompts ?? history.body.history ?? []).toHaveLength(1)
  })
})
