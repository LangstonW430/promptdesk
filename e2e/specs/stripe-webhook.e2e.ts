import { randomUUID } from 'node:crypto'
import Stripe from 'stripe'
import { beforeEach, describe, expect, it } from 'vitest'
import { encryptKey } from '@/lib/finance/stripe-key'
import { appUrl, createUser, db, type TestUser } from '../harness/context'

/**
 * The Stripe webhook endpoint.
 *
 * Stripe arrives with no session and no cookies, which makes this the one
 * inbound surface the session gate cannot help with — and the reason it needed
 * an end-to-end test more than anything else here. It had never been reachable:
 * the proxy redirected every delivery to /login and the handler never ran, so
 * invoice status only ever moved when somebody pressed "Refresh from Stripe".
 * Nothing short of a real request over HTTP would have shown that, because the
 * handler itself was always correct.
 *
 * The signature is real. `Stripe.webhooks.constructEvent` is pure HMAC against
 * the stored secret, so signing with the same secret exercises verification
 * properly rather than stubbing past it.
 */

const SECRET = 'whsec_e2e_test_secret'

/** An event body Stripe would post, signed the way Stripe signs it. */
function signed(event: Record<string, unknown>, secret = SECRET) {
  const payload = JSON.stringify(event)
  return {
    payload,
    signature: Stripe.webhooks.generateTestHeaderString({ payload, secret }),
  }
}

function invoiceEvent(type: string, invoice: Record<string, unknown>) {
  return {
    id: `evt_${randomUUID().replace(/-/g, '')}`,
    object: 'event',
    api_version: '2026-05-27.dahlia',
    created: Math.floor(Date.now() / 1000),
    type,
    data: { object: { object: 'invoice', ...invoice } },
  }
}

/**
 * A webhook POST with the body sent verbatim.
 *
 * The signature covers the exact bytes, so this cannot go through the JSON
 * helper in the harness — re-encoding the object would change them.
 */
async function fetchWebhook(token: string, payload: string, signature: string) {
  const res = await fetch(`${appUrl}/api/webhooks/stripe/${token}`, {
    method: 'POST',
    redirect: 'manual',
    headers: { 'content-type': 'application/json', 'stripe-signature': signature },
    body: payload,
  })
  return { status: res.status, text: await res.text() }
}

describe('the Stripe webhook endpoint', () => {
  let user: TestUser
  let token: string

  beforeEach(async () => {
    user = await createUser()
    token = randomUUID()
    await db.query(
      'UPDATE users SET webhook_token = $1, stripe_webhook_secret = $2 WHERE id = $3',
      [token, encryptKey(SECRET), user.id],
    )
  })

  it('is reachable without a session at all', async () => {
    const res = await fetchWebhook(token, '{}', 'nonsense')

    // Anything but a redirect to /login. The handler answering — even to
    // refuse — is the point.
    expect(res.status).not.toBe(307)
  })

  it('rejects an unsigned request', async () => {
    const res = await fetchWebhook(token, JSON.stringify(invoiceEvent('invoice.voided', {})), '')

    expect(res.status).toBe(400)
    expect(res.text).toContain('signature verification failed')
  })

  it('rejects a body that was tampered with after signing', async () => {
    const { payload, signature } = signed(
      invoiceEvent('invoice.voided', { id: 'in_test', status: 'void' }),
    )

    const res = await fetchWebhook(token, payload.replace('void', 'paid'), signature)

    expect(res.status).toBe(400)
  })

  it('404s an unknown token rather than accepting it quietly', async () => {
    const { payload, signature } = signed(invoiceEvent('invoice.voided', {}))

    const res = await fetchWebhook(randomUUID(), payload, signature)

    expect(res.status).toBe(404)
  })

  /**
   * The reason each user has their own endpoint and their own secret. An event
   * genuinely signed by one Stripe account must not be accepted at another
   * user's token — that is precisely the misattribution the shared endpoint
   * used to allow.
   */
  it('refuses an event signed with a different account/s secret', async () => {
    const other = await createUser()
    const otherToken = randomUUID()
    await db.query(
      'UPDATE users SET webhook_token = $1, stripe_webhook_secret = $2 WHERE id = $3',
      [otherToken, encryptKey('whsec_a_different_account'), other.id],
    )

    const { payload, signature } = signed(invoiceEvent('invoice.voided', { id: 'in_test' }))

    const res = await fetchWebhook(otherToken, payload, signature)

    expect(res.status).toBe(400)
  })

  it('applies a verified event to that owner/s invoice', async () => {
    const invoiceId = randomUUID()
    await db.query(
      `INSERT INTO invoices
         (id, owner_id, stripe_invoice_id, line_items, status, issue_date, subtotal, total)
       VALUES ($1, $2, $3, '[]'::jsonb, 'open', CURRENT_DATE, 100, 100)`,
      [invoiceId, user.id, 'in_e2e_1'],
    )

    const { payload, signature } = signed(
      invoiceEvent('invoice.voided', {
        id: 'in_e2e_1',
        status: 'void',
        created: Math.floor(Date.now() / 1000),
        subtotal: 10000,
        total: 10000,
        lines: { object: 'list', data: [] },
      }),
    )

    const res = await fetchWebhook(token, payload, signature)

    expect(res.status).toBe(200)
    const { rows } = await db.query('SELECT status FROM invoices WHERE id = $1', [invoiceId])
    expect(rows[0].status).toBe('void')
  })

  /**
   * Same verified event, but the invoice belongs to somebody else. The handler
   * is scoped by the owner the token resolved to, so it must find nothing — a
   * 200 with no write, rather than a 200 that edited another account's invoice.
   */
  it('leaves another owner/s invoice alone even for a properly signed event', async () => {
    const other = await createUser()
    const invoiceId = randomUUID()
    await db.query(
      `INSERT INTO invoices
         (id, owner_id, stripe_invoice_id, line_items, status, issue_date, subtotal, total)
       VALUES ($1, $2, $3, '[]'::jsonb, 'open', CURRENT_DATE, 100, 100)`,
      [invoiceId, other.id, 'in_e2e_2'],
    )

    const { payload, signature } = signed(
      invoiceEvent('invoice.voided', {
        id: 'in_e2e_2',
        status: 'void',
        created: Math.floor(Date.now() / 1000),
        subtotal: 10000,
        total: 10000,
        lines: { object: 'list', data: [] },
      }),
    )

    const res = await fetchWebhook(token, payload, signature)

    expect(res.status).toBe(200)
    const { rows } = await db.query('SELECT status FROM invoices WHERE id = $1', [invoiceId])
    expect(rows[0].status).toBe('open')
  })
})
