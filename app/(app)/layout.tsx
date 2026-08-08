import { Suspense } from 'react'
import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'
import { TourProvider } from '@/components/onboarding/tour-provider'

export default function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal?: React.ReactNode
}) {
  return (
    <TourProvider>
      {/* Print: the sidebar and topbar hide themselves, so the page also drops
          the gutter it was leaving for them and prints edge to edge. */}
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="flex flex-col lg:pl-60 print:pl-0">
          <Suspense fallback={<div className="h-14 border-b bg-background/95 print:hidden" />}>
            <Topbar />
          </Suspense>
          <main className="flex-1 p-6 print:p-0">{children}</main>
        </div>
        {modal}
      </div>
    </TourProvider>
  )
}
