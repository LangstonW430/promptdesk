import { prisma } from '@/lib/db/client'

export interface UserSettings {
  onboardingDismissed?: boolean
  sampleDataLoaded?: boolean
  tokenBudget?: number
}

export async function getUserSettings(ownerId: string): Promise<UserSettings> {
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { settings: true },
  })
  if (!user) return {}
  return (user.settings as UserSettings) ?? {}
}

export type UserProfilePatch = {
  fullName?: string | null
  businessName?: string | null
  businessType?: string | null
  defaultAi?: string | null
  businessAddress?: string | null
  businessPhone?: string | null
  taxNumber?: string | null
  defaultPaymentTerms?: string | null
}

/**
 * Writes the profile fields, and only those.
 *
 * The patch used to be spread straight into `prisma.user.update`. Nothing
 * validated it at runtime — a `'use server'` export is a reachable RPC
 * endpoint, and the TypeScript signature stops nothing there — so any column
 * on the user row, `email` and `stripeKey` included, could be set by naming it
 * in the request body. Callers now go through updateUserProfileSchema, and
 * this picks the keys explicitly rather than trusting the object it is given.
 */
export async function updateUserProfile(
  ownerId: string,
  patch: UserProfilePatch,
): Promise<void> {
  const data: UserProfilePatch = {}
  const keys = [
    'fullName',
    'businessName',
    'businessType',
    'defaultAi',
    'businessAddress',
    'businessPhone',
    'taxNumber',
    'defaultPaymentTerms',
  ] as const
  for (const key of keys) {
    if (patch[key] !== undefined) data[key] = patch[key]
  }
  await prisma.user.update({ where: { id: ownerId }, data })
}

export async function updateUserSettings(
  ownerId: string,
  patch: Partial<UserSettings>,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { settings: true },
  })
  const current = (user?.settings as Record<string, unknown>) ?? {}
  await prisma.user.update({
    where: { id: ownerId },
    data: { settings: { ...current, ...patch } },
  })
}
