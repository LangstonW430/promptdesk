import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import { TooltipProvider } from '@/components/ui/tooltip'
import { THEME_INIT_SCRIPT } from '@/lib/theme'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'PromptDesk',
  description: 'AI-assisted CRM for solo freelancers and small service businesses',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The script below sets `class` and `data-theme` on this element before
      // React hydrates, so the client tree legitimately differs from what the
      // server sent. Scoped to <html>; it does not suppress warnings deeper in
      // the tree.
      suppressHydrationWarning
    >
      <head>
        {/* Blocking and inline, before anything paints. Deferring this means a
            white flash on every navigation for anyone using dark mode. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="h-full">
        <TooltipProvider>{children}</TooltipProvider>
      </body>
    </html>
  )
}
