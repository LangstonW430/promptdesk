import { MobileNav } from '@/components/layout/mobile-nav'
import { UserMenu } from '@/components/layout/user-menu'
import { getCurrentUser } from '@/lib/auth'

export async function Topbar() {
  const user = await getCurrentUser()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <MobileNav />
      <div className="flex flex-1 items-center justify-end gap-2">
        {/* Theme and sign-out used to sit loose beside the avatar. They live in
            the account menu now, so the bar carries one control rather than
            three and the avatar does what its appearance already promised. */}
        <UserMenu email={user?.email ?? ''} />
      </div>
    </header>
  )
}
