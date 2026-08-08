'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getOwnerId } from '@/lib/auth'
import { updateUserSettings, updateUserProfile } from '@/lib/users'
import type { UserSettings } from '@/lib/users'

export async function dismissOnboardingAction(): Promise<{ success: boolean }> {
  const ownerId = await getOwnerId()
  await updateUserSettings(ownerId, { onboardingDismissed: true })
  revalidatePath('/dashboard')
  return { success: true }
}

/**
 * An empty string clears the field. The form sends '' when the user empties an
 * input, and a detail has to be removable — otherwise a stale address stays on
 * every invoice forever.
 */
const blankToNull = z
  .string()
  .max(500)
  .transform((v) => (v.trim() === '' ? null : v))

const updateUserProfileSchema = z.object({
  fullName: blankToNull.optional(),
  businessName: blankToNull.optional(),
  businessType: blankToNull.optional(),
  defaultAi: blankToNull.optional(),
  businessAddress: blankToNull.optional(),
  businessPhone: blankToNull.optional(),
  taxNumber: blankToNull.optional(),
  defaultPaymentTerms: z.string().max(120).transform((v) => (v.trim() === '' ? null : v)).optional(),
})

export async function updateUserProfileAction(data: unknown): Promise<{ error?: string }> {
  const parsed = updateUserProfileSchema.safeParse(data)
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }
  try {
    const ownerId = await getOwnerId()
    await updateUserProfile(ownerId, parsed.data)
    revalidatePath('/settings')
    // The From block on every invoice reads these.
    revalidatePath('/invoices')
    return {}
  } catch {
    return { error: 'Failed to save.' }
  }
}

export async function updateUserSettingsAction(
  patch: Partial<UserSettings>,
): Promise<{ error?: string }> {
  try {
    const ownerId = await getOwnerId()
    await updateUserSettings(ownerId, patch)
    revalidatePath('/settings')
    revalidatePath('/dashboard')
    return {}
  } catch {
    return { error: 'Failed to save.' }
  }
}
