import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'
import {
  BrainCircuit,
  ArrowRight,
  Copy,
  Users,
  Bell,
  BarChart3,
  Zap,
  ExternalLink,
  CheckCircle,
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
          <div className="flex items-center gap-2 font-semibold">
            <BrainCircuit className="h-4 w-4 text-primary" />
            <span>PromptDesk</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
            >
              Sign in
            </Link>
            <Link href="/signup" className={cn(buttonVariants({ size: 'sm' }))}>
              Get started →
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero — left-aligned split layout */}
        <section className="mx-auto max-w-6xl px-6 py-20 lg:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_420px]">
            {/* Left */}
            <div>
              <div className="mb-5 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/20">
                <Zap className="h-3 w-3" />
                No AI subscription needed
              </div>
              <h1 className="mb-5 text-5xl font-bold leading-[1.1] tracking-tight lg:text-6xl">
                The CRM that writes
                <br />
                your AI prompts
                <br />
                <span className="text-primary">for you.</span>
              </h1>
              <p className="mb-8 max-w-md text-lg text-muted-foreground">
                Manage your clients and pipeline. Then generate a context-rich, perfectly
                structured prompt for any AI — in one click.
              </p>
              <div className="flex flex-wrap gap-3">
                <Link
                  href="/signup"
                  className={cn(buttonVariants({ size: 'lg' }), 'gap-1.5')}
                >
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/login"
                  className={cn(buttonVariants({ variant: 'outline', size: 'lg' }))}
                >
                  Sign in
                </Link>
              </div>
            </div>

            {/* Right — prompt card mockup */}
            <div className="hidden lg:block">
              <div className="relative">
                <div className="rounded-2xl border bg-card shadow-xl">
                  <div className="flex items-center justify-between border-b px-5 py-4">
                    <div>
                      <div className="text-sm font-semibold">Business Action Plan</div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Generated just now · 847 tokens
                      </div>
                    </div>
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                      <BrainCircuit className="h-3.5 w-3.5 text-primary" />
                    </div>
                  </div>
                  <div className="space-y-3 p-5 font-mono text-xs leading-relaxed text-foreground/75">
                    <p>
                      <span className="font-semibold text-primary">Role:</span> You are an
                      expert business advisor for a solo web developer with 12 active
                      clients…
                    </p>
                    <div className="rounded-lg bg-muted/60 p-3 space-y-1.5">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Pipeline value</span>
                        <span className="font-medium text-foreground">$84,500</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Overdue follow-ups</span>
                        <span className="font-medium text-destructive">3 clients</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Hot opportunity</span>
                        <span className="font-medium text-foreground">Acme Corp — $12k</span>
                      </div>
                    </div>
                    <p>
                      <span className="font-semibold text-primary">Task:</span> Generate a
                      7-day action plan with specific outreach messages for each priority
                      client…
                    </p>
                  </div>
                  <div className="flex gap-2 border-t px-5 py-3">
                    <span className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">
                      <Copy className="h-3 w-3" /> Copy prompt
                    </span>
                    <span className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium">
                      <ExternalLink className="h-3 w-3" /> Open in ChatGPT
                    </span>
                  </div>
                </div>
                <div className="absolute -bottom-4 -left-4 flex items-center gap-2 rounded-xl border bg-background px-3 py-2 shadow-lg text-xs font-medium">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  Paste into any AI — no lock-in
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Works with strip */}
        <div className="border-y bg-muted/20 py-4">
          <p className="text-center text-xs text-muted-foreground">
            Paste prompts into&ensp;
            <span className="font-medium text-foreground">ChatGPT</span>
            <span className="mx-2 opacity-30">·</span>
            <span className="font-medium text-foreground">Claude</span>
            <span className="mx-2 opacity-30">·</span>
            <span className="font-medium text-foreground">Gemini</span>
            <span className="mx-2 opacity-30">·</span>
            <span className="font-medium text-foreground">Grok</span>
            <span className="mx-2 opacity-30">·</span>
            <span className="font-medium text-foreground">Perplexity</span>
            &ensp;— or any AI you already use
          </p>
        </div>

        {/* Problem statement — dark/inverted section */}
        <section className="bg-foreground py-20 text-background">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
              <div>
                <p className="mb-4 text-sm font-medium uppercase tracking-widest text-background/40">
                  The problem
                </p>
                <h2 className="text-3xl font-bold tracking-tight lg:text-4xl">
                  Every AI conversation starts with you re-typing the same context from
                  scratch.
                </h2>
              </div>
              <div className="space-y-4 text-background/70">
                <p>
                  Who&apos;s your client? What&apos;s their budget? What did you last discuss? What&apos;s
                  the deal status? You know all of this — it&apos;s in your head and your notes.
                  But your AI doesn&apos;t.
                </p>
                <p>
                  PromptDesk fixes that. It keeps your structured business data and assembles
                  it into a production-ready prompt automatically. You get better AI answers
                  with zero manual context-setting.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features — asymmetric bento grid */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <div className="mb-10">
            <h2 className="text-2xl font-bold tracking-tight">
              Built for solo operators
            </h2>
            <p className="mt-1.5 text-muted-foreground">
              No enterprise overhead. Just the tools a one-person business actually uses.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {/* Large — Pipeline */}
            <div className="rounded-2xl border bg-card p-6 sm:col-span-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Users className="h-4 w-4 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Client pipeline</h3>
              <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                Kanban and table views. Drag leads through stages, track deal values, and
                surface a weighted revenue forecast — without a 30-tab spreadsheet.
              </p>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs">
                {[
                  ['Lead', '4', 'text-muted-foreground'],
                  ['Proposal', '2', 'text-amber-600'],
                  ['Negotiating', '1', 'text-primary'],
                ].map(([label, count, color]) => (
                  <div key={label} className="rounded-lg border bg-muted/40 py-2.5">
                    <div className={`text-base font-bold ${color}`}>{count}</div>
                    <div className="text-muted-foreground">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Small — Daily Actions */}
            <div className="rounded-2xl border bg-card p-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Bell className="h-4 w-4 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">Daily Action Center</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Open the app and see exactly who to contact today. Overdue follow-ups, hot
                leads, and going-cold clients surfaced automatically.
              </p>
            </div>

            {/* Small — Dashboard */}
            <div className="rounded-2xl border bg-card p-6">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <BarChart3 className="h-4 w-4 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold">Business dashboard</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Pipeline totals, weighted forecast, conversion rate, and recommended
                actions — one view, always current.
              </p>
            </div>

            {/* Large — Prompt engine */}
            <div className="rounded-2xl border bg-card p-6 sm:col-span-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <BrainCircuit className="h-4 w-4 text-primary" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">Prompt Builder Engine</h3>
              <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
                Eight built-in templates. The engine scores, ranks, and compresses your data
                to fit any model&apos;s context window — then hands you a copy-ready prompt.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {[
                  'Business Action Plan',
                  'Client Insight',
                  'Note Analysis',
                  'Revenue Analysis',
                  'Lead Qualification',
                  '+3 more',
                ].map((t) => (
                  <span
                    key={t}
                    className="rounded-full border bg-muted/40 px-2.5 py-0.5 text-xs text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* How it works — horizontal steps with big numbers */}
        <section className="border-y bg-muted/20 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid gap-16 lg:grid-cols-2 lg:items-start">
              <div>
                <p className="mb-3 text-sm font-medium uppercase tracking-widest text-primary">
                  How it works
                </p>
                <h2 className="mb-4 text-2xl font-bold tracking-tight lg:text-3xl">
                  From CRM data to paste-ready prompt in seconds.
                </h2>
                <p className="text-muted-foreground">
                  A deterministic pipeline — no AI on our end. Your data goes in, an
                  optimized prompt comes out.
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
                  <div key={n} className="flex gap-5">
                    <div className="mt-0.5 shrink-0 text-3xl font-bold tabular-nums text-primary/20">
                      {n}
                    </div>
                    <div>
                      <div className="font-semibold">{title}</div>
                      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA — primary color block */}
        <section className="bg-primary py-20 text-primary-foreground">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <h2 className="mb-3 text-3xl font-bold tracking-tight lg:text-4xl">
              Your pipeline. Your prompts. Your AI.
            </h2>
            <p className="mb-8 text-primary-foreground/70">
              Free to start. No credit card. Works with every AI tool you already pay for.
            </p>
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-white/90"
            >
              Create your free account <ArrowRight className="h-4 w-4" />
            </Link>
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
