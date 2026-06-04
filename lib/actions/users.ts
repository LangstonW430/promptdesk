'use server'

import { revalidatePath } from 'next/cache'
import { getOwnerId } from '@/lib/auth'
import { updateUserSettings } from '@/lib/users'

export async function dismissOnboardingAction(): Promise<{ success: boolean }> {
  const ownerId = await getOwnerId()
  await updateUserSettings(ownerId, { onboardingDismissed: true })
  revalidatePath('/dashboard')
  return { success: true }
}
