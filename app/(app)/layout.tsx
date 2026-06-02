import { Sidebar } from '@/components/layout/sidebar'
import { Topbar } from '@/components/layout/topbar'

export default function AppLayout({
  children,
  modal,
}: {
  children: React.ReactNode
  modal?: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col lg:pl-60">
        <Topbar />
        <main className="flex-1 p-6">{children}</main>
      </div>
      {modal}
    </div>
  )
}
