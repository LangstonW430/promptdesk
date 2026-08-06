import { MobileNav } from '@/components/layout/mobile-nav'
import { ThemeToggle } from '@/components/layout/theme-toggle'
import { getCurrentUser } from '@/lib/auth'
import { signOut } from '@/lib/actions/auth'
import { Button } from '@/components/ui/button'
import { LogOut } from 'lucide-react'

export async function Topbar() {
  const user = await getCurrentUser()
  const initial = user?.email?.[0].toUpperCase() ?? '?'

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <MobileNav />
      <div className="flex flex-1 items-center justify-end gap-2">
        <ThemeToggle />
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary"
          title={user?.email}
          aria-label={`Signed in as ${user?.email}`}
        >
          {initial}
        </div>
        <form action={signOut}>
          <Button
            type="submit"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </header>
  )
}
