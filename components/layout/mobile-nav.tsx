'use client'

import { useState } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { NavItemList } from '@/components/layout/nav-items'

export function MobileNav() {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={() => setOpen(true)}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-60 bg-sidebar p-0">
          <SheetHeader className="flex h-14 flex-row items-center border-b border-sidebar-border px-4">
            <SheetTitle className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
                PD
              </div>
              PromptDesk
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col overflow-y-auto px-3 py-4">
            <NavItemList onNavigate={() => setOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
