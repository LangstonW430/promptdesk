'use client'

import { TourContextProvider } from './tour-context'
import { TourBanner } from './tour-banner'

export function TourProvider({ children }: { children: React.ReactNode }) {
  return (
    <TourContextProvider>
      {children}
      <TourBanner />
    </TourContextProvider>
  )
}
