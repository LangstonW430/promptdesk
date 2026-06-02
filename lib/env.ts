import { z } from 'zod'

const envSchema = z.object({
  // Supabase — available in browser (prefixed NEXT_PUBLIC_)
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),

  // Supabase — server-only secrets
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Prisma — Supabase Transaction pooler URL (used at runtime)
  DATABASE_URL: z.string().min(1),
  // Prisma — Supabase direct connection (used for migrations only)
  DIRECT_URL: z.string().min(1),

  // Canonical origin for auth callbacks and absolute URLs
  NEXT_PUBLIC_APP_URL: z.url(),
})

// Throws a descriptive ZodError at startup if any required var is absent
export const env = envSchema.parse(process.env)
