import { afterAll, beforeEach } from 'vitest'
import { db, reset } from './context'
import { STRIPE_ENCRYPTION_KEY } from './env'

// A test that seeds an encrypted Stripe secret has to encrypt it with the same
// key the app decrypts with. Set before any spec imports lib/finance/stripe-key.
process.env.STRIPE_ENCRYPTION_KEY = STRIPE_ENCRYPTION_KEY

// One database serves every test, so each one starts from an empty schema.
// The suite runs single-file, single-thread (see vitest.e2e.config.ts) for the
// same reason: two tests truncating around each other would be unreadable.
beforeEach(reset)

afterAll(async () => {
  await db.end()
})
