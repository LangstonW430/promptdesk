'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Sparkles,
  Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const navItems = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: 'Clients',
    href: '/clients',
    icon: Users,
  },
  {
    label: 'Daily Actions',
    href: '/daily-actions',
    icon: CheckSquare,
  },
  {
    label: 'Prompts',
    href: '/prompts',
    icon: Sparkles,
  },
] as const

export const bottomNavItems = [
  {
    label: 'Settings',
    href: '/settings',
    icon: Settings,
  },
] as const

type NavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

function NavLink({ item, onClick }: { item: NavItem; onClick?: () => void }) {
  const pathname = usePathname()
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={cn(
        'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      {item.label}
    </Link>
  )
}

export function NavItemList({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav className="flex flex-1 flex-col gap-1">
      <div className="flex flex-col gap-1">
        {navItems.map((item) => (
          <NavLink key={item.href} item={item} onClick={onNavigate} />
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-1 pt-4">
        {bottomNavItems.map((item) => (
          <NavLink key={item.href} item={item} onClick={onNavigate} />
        ))}
      </div>
    </nav>
  )
}
