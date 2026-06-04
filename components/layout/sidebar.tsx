import { NavItemList } from '@/components/layout/nav-items'

export function Sidebar() {
  return (
    <aside aria-label="Main navigation" className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-14 items-center border-b border-sidebar-border px-4">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            PD
          </div>
          <span className="text-sm font-semibold tracking-tight">PromptDesk</span>
        </div>
      </div>
      <div className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
        <NavItemList />
      </div>
    </aside>
  )
}
