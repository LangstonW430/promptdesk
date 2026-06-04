/**
 * Signature verification tests for the Stripe webhook handler.
 *
 * Stripe.webhooks is a static property of the Stripe class — no API key
 * or network connection is required. These tests exercise pure HMAC-SHA256
 * verification logic so they run fully offline.
 */
import { describe, it, expect } from 'vitest'
import Stripe from 'stripe'

const SECRET = 'whsec_test_signing_secret_for_unit_tests_only'

const PAYLOAD = JSON.stringify({
  id: 'evt_test123',
  object: 'event',
  type: 'charge.succeeded',
  data: { object: { id: 'ch_test', amount: 10000, currency: 'usd' } },
})

// Generates a valid Stripe-Signature header for the given payload and secret.
function validHeader(payload = PAYLOAD): string {
  return Stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET })
}

describe('Stripe.webhooks.constructEvent — signature verification', () => {
  it('accepts a correctly signed payload', () => {
    const sig = validHeader()
    expect(() => Stripe.webhooks.constructEvent(PAYLOAD, sig, SECRET)).not.toThrow()
    const event = Stripe.webhooks.constructEvent(PAYLOAD, sig, SECRET)
    expect(event.type).toBe('charge.succeeded')
  })

  it('rejects a forged signature (wrong v1 value)', () => {
    const badSig = 't=1735689600,v1=0000000000000000000000000000000000000000000000000000000000000000'
    expect(() =>
      Stripe.webhooks.constructEvent(PAYLOAD, badSig, SECRET),
    ).toThrow()
  })

  it('rejects a payload tampered after signing', () => {
    const sig = validHeader()
    const tampered = PAYLOAD.replace('10000', '99999')
    expect(() =>
      Stripe.webhooks.constructEvent(tampered, sig, SECRET),
    ).toThrow()
  })

  it('rejects an empty signature header', () => {
    expect(() =>
      Stripe.webhooks.constructEvent(PAYLOAD, '', SECRET),
    ).toThrow()
  })

  it('rejects a signature signed with a different secret', () => {
    const wrongSecretSig = Stripe.webhooks.generateTestHeaderString({
      payload: PAYLOAD,
      secret: 'whsec_a_completely_different_secret',
    })
    expect(() =>
      Stripe.webhooks.constructEvent(PAYLOAD, wrongSecretSig, SECRET),
    ).toThrow()
  })

  it('returns the parsed event object on success', () => {
    const sig = validHeader()
    const event = Stripe.webhooks.constructEvent(PAYLOAD, sig, SECRET)
    expect(event.id).toBe('evt_test123')
    expect(event.type).toBe('charge.succeeded')
    // Confirms the body was not double-parsed or mutated
    expect((event.data.object as { amount: number }).amount).toBe(10000)
  })

  it('different payloads produce different signatures (no cross-replay)', () => {
    const other = JSON.stringify({ id: 'evt_other', type: 'charge.refunded' })
    const sigForOther = validHeader(other)
    // The original PAYLOAD signature must not validate against a different payload
    expect(() =>
      Stripe.webhooks.constructEvent(PAYLOAD, sigForOther, SECRET),
    ).toThrow()
  })
})
