import { prisma } from '@/lib/db/client'

export interface UserSettings {
  onboardingDismissed?: boolean
  sampleDataLoaded?: boolean
  stageProbabilities?: Record<string, number>
}

export async function getUserSettings(ownerId: string): Promise<UserSettings> {
  const user = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { settings: true },
  })
  if (!user) return {}
  return (user.settings as UserSettings) ?? {}
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
