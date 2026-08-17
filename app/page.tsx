import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import {
  BrainCircuit,
  ArrowRight,
  Copy,
  Bell,
  BarChart3,
  Kanban,
  Sparkles,
} from 'lucide-react'

export default async function LandingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) redirect('/dashboard')

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <BrainCircuit className="h-4 w-4 text-primary" strokeWidth={2.25} />
            PromptDesk
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            >
              Sign in
            </Link>
            <Link href="/signup" className={cn(buttonVariants({ size: 'sm' }))}>
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 lg:pb-24 lg:pt-24">
          <div className="grid gap-14 lg:grid-cols-[1fr_460px] lg:gap-10">
            {/* Left */}
            <div className="lg:pt-3">
              <p className="mb-4 font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                CRM for solo freelancers — no AI subscription required
              </p>
              <h1 className="mb-5 max-w-xl text-[2.75rem] font-semibold leading-[1.08] tracking-tight lg:text-5xl">
                Your client data, turned into the prompt you were about to type anyway.
              </h1>
              <p className="mb-8 max-w-md text-base leading-relaxed text-muted-foreground">
                Track clients and pipeline like any CRM. When you need AI help, PromptDesk
                assembles the context — deal history, notes, follow-ups — into one
                structured prompt you paste into ChatGPT, Claude, or whatever you use.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <Link
                  href="/signup"
                  className={cn(buttonVariants({ size: 'lg' }), 'gap-1.5')}
                >
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  Sign in instead
                </Link>
              </div>
            </div>

            {/* Right — real product framing, not a floating glossy card */}
            <div className="hidden lg:block">
              <div className="overflow-hidden rounded-lg border bg-card">
                <div className="flex items-center gap-1.5 border-b bg-muted/40 px-4 py-2.5">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/25" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/25" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/25" />
                  <span className="ml-3 font-mono text-[11px] text-muted-foreground">
                    promptdesk.app/clients/acme-corp
                  </span>
                </div>
                <div className="grid grid-cols-[104px_1fr]">
                  <div className="space-y-3 border-r px-3 py-4 text-xs text-muted-foreground">
                    <div className="rounded-md bg-primary/10 px-2 py-1 font-medium text-primary">
                      Clients
                    </div>
                    <div className="px-2 py-1">Pipeline</div>
                    <div className="px-2 py-1">Invoices</div>
                    <div className="px-2 py-1">Prompts</div>
                  </div>
                  <div className="space-y-3 px-4 py-4">
                    <div>
                      <div className="text-sm font-semibold">Acme Corp</div>
                      <div className="mt-0.5 flex gap-3 font-mono text-[11px] text-muted-foreground">
                        <span>Negotiating</span>
                        <span>$12,000</span>
                        <span className="text-destructive">3d overdue</span>
                      </div>
                    </div>
                    <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      Last note: &ldquo;Wants revised scope by Friday, budget flexible
                      &plusmn;10%&rdquo;
                    </div>
                    <div className="flex items-center gap-2 border-t pt-3">
                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                      <span className="text-xs font-medium">
                        Generate: Client Insight prompt
                      </span>
                    </div>
                    <div className="rounded-md bg-foreground p-3 font-mono text-[11px] leading-relaxed text-background">
                      <span className="text-background/50">Role:</span> You are an
                      advisor for a solo web developer&hellip;
                      <br />
                      <span className="text-background/50">Context:</span> Acme Corp,
                      $12k deal, negotiating stage&hellip;
                    </div>
                    <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                      <Copy className="h-3 w-3" /> Copy prompt
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Works with strip */}
        <div className="border-y">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-2 px-6 py-3.5 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
            <span>Paste into</span>
            <span className="text-foreground">ChatGPT</span>
            <span className="text-foreground">Claude</span>
            <span className="text-foreground">Gemini</span>
            <span className="text-foreground">Grok</span>
            <span className="text-foreground">Perplexity</span>
            <span>or anything else you use</span>
          </div>
        </div>

        {/* Problem statement */}
        <section className="bg-foreground py-20 text-background">
          <div className="mx-auto max-w-3xl px-6 text-center">
            <p className="mb-5 font-mono text-xs uppercase tracking-[0.14em] text-background/40">
              The problem
            </p>
            <p className="text-2xl font-medium leading-snug tracking-tight lg:text-3xl">
              Every AI conversation starts with you re-typing context you already have —
              who the client is, what they need, where the deal stands.
            </p>
            <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-background/60">
              PromptDesk keeps that data structured and assembles it into a ready prompt
              automatically, so you get better answers without manual context-setting.
            </p>
          </div>
        </section>

        {/* Features — editorial list, not an icon-tile grid */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-10 max-w-lg">
            <h2 className="text-2xl font-semibold tracking-tight">
              Built for one person running the whole business.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              No enterprise overhead — just the parts of a CRM a solo operator actually
              opens every day.
            </p>
          </div>

          <div className="divide-y border-y">
            {[
              {
                icon: Kanban,
                title: 'Client pipeline',
                body: 'Kanban and table views. Drag leads through stages, track deal values, and see a weighted revenue forecast without a spreadsheet.',
              },
              {
                icon: Bell,
                title: 'Daily Action Center',
                body: 'Open the app and see exactly who to contact today — overdue follow-ups, hot leads, and clients going cold, surfaced automatically.',
              },
              {
                icon: BarChart3,
                title: 'Business dashboard',
                body: 'Pipeline totals, conversion rate, and recommended next actions in one view that stays current as your data changes.',
              },
              {
                icon: BrainCircuit,
                title: 'Prompt Builder Engine',
                body: 'Eight built-in templates score, rank, and compress your data to fit any model’s context window, then hand you a copy-ready prompt.',
              },
            ].map(({ icon: Icon, title, body }, i) => (
              <div
                key={title}
                className="grid gap-3 py-7 sm:grid-cols-[64px_180px_1fr] sm:items-start sm:gap-6"
              >
                <span className="font-mono text-xs text-muted-foreground/60">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex items-center gap-2 text-sm font-semibold">
                  <Icon className="h-4 w-4 text-primary" strokeWidth={2} />
                  {title}
                </div>
                <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="border-y bg-muted/20 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-16 lg:grid-cols-2 lg:items-start">
              <div>
                <p className="mb-3 font-mono text-xs uppercase tracking-[0.14em] text-primary">
                  How it works
                </p>
                <h2 className="mb-4 text-2xl font-semibold tracking-tight lg:text-3xl">
                  From CRM data to a paste-ready prompt in seconds.
                </h2>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  A deterministic pipeline — no AI on our end. Your data goes in, an
                  optimized prompt comes out the same way, every time.
                </p>
              </div>
              <div className="space-y-7">
                {[
                  {
                    n: '01',
                    title: 'Add your clients',
                    body: 'Import from CSV or build from scratch. Every note, follow-up date, and deal value lives in one place.',
                  },
                  {
                    n: '02',
                    title: 'Pick a template',
                    body: 'Choose from eight built-in prompt types. The engine selects and prioritizes only the data relevant to your goal.',
                  },
                  {
                    n: '03',
                    title: 'Copy and paste',
                    body: 'Your prompt arrives pre-structured and context-rich. Open ChatGPT, Claude, or any AI and paste — no retyping.',
                  },
                ].map(({ n, title, body }) => (
                  <div key={n} className="flex gap-5 border-l-2 border-primary/20 pl-5">
                    <div className="w-7 shrink-0 font-mono text-sm tabular-nums text-primary">
                      {n}
                    </div>
                    <div>
                      <div className="text-sm font-semibold">{title}</div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="flex flex-col items-start justify-between gap-8 rounded-lg border bg-card px-8 py-12 lg:flex-row lg:items-center lg:px-12">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight lg:text-3xl">
                  Your pipeline. Your prompts. Your AI.
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Free to start. No credit card. Works with every AI tool you already pay
                  for.
                </p>
              </div>
              <Link
                href="/signup"
                className={cn(buttonVariants({ size: 'lg' }), 'shrink-0 gap-1.5')}
              >
                Create your free account <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 sm:flex-row">
          <div className="flex items-center gap-2 text-sm font-medium">
            <BrainCircuit className="h-4 w-4 text-primary" />
            PromptDesk
          </div>
          <p className="text-xs text-muted-foreground">
            AI-assisted CRM for solo freelancers and small service businesses.
          </p>
          <div className="flex gap-4 text-xs text-muted-foreground">
            <Link href="/login" className="transition-colors hover:text-foreground">
              Sign in
            </Link>
            <Link href="/signup" className="transition-colors hover:text-foreground">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
