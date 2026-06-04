'use server'

import { revalidatePath } from 'next/cache'
import { getOwnerId } from '@/lib/auth'
import { loadSampleData, clearSampleData, hasSampleData } from '@/lib/sample-data'

export async function loadSampleDataAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const ownerId = await getOwnerId()
    await loadSampleData(ownerId)
    revalidatePath('/dashboard')
    revalidatePath('/clients')
    revalidatePath('/daily-actions')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to load sample data' }
  }
}

export async function clearSampleDataAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const ownerId = await getOwnerId()
    await clearSampleData(ownerId)
    revalidatePath('/dashboard')
    revalidatePath('/clients')
    revalidatePath('/daily-actions')
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Failed to clear sample data' }
  }
}

export async function hasSampleDataAction(): Promise<boolean> {
  const ownerId = await getOwnerId()
  return hasSampleData(ownerId)
}
