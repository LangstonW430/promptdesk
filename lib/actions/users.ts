'use server'

import { revalidatePath } from 'next/cache'
import { getOwnerId } from '@/lib/auth'
import { updateUserSettings, updateUserProfile } from '@/lib/users'
import type { UserSettings } from '@/lib/users'

export async function dismissOnboardingAction(): Promise<{ success: boolean }> {
  const ownerId = await getOwnerId()
  await updateUserSettings(ownerId, { onboardingDismissed: true })
  revalidatePath('/dashboard')
  return { success: true }
}

export async function updateUserProfileAction(data: {
  fullName?: string
  businessName?: string
  businessType?: string
  defaultAi?: string
}): Promise<{ error?: string }> {
  try {
    const ownerId = await getOwnerId()
    await updateUserProfile(ownerId, data)
    revalidatePath('/settings')
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
