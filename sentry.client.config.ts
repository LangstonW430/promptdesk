import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Capture 10% of transactions for performance monitoring in production.
  // Use 1.0 (100%) in development or staging if you want full traces.
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

  // Session Replay is Sentry's heaviest browser addon: it adds a sizeable
  // chunk to the client bundle and, once a session is being recorded, runs
  // continuous DOM mutation observers for the lifetime of the tab.
  //
  // It is no longer registered up front — it is loaded on demand below, which
  // keeps it out of the initial bundle. Session sampling is off; replays are
  // captured for errors only, which is what they were mainly serving anyway
  // (replaysOnErrorSampleRate was already 1.0 while session sampling caught an
  // unrelated 10% at full cost to every visitor).
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 1.0,

  // Only enable in production or when DSN is explicitly set
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
})

// Pull Replay in after first paint so it never competes with initial render or
// navigation. `lazyLoadIntegration` fetches it separately and registers it
// against the already-initialised client.
if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_SENTRY_DSN) {
  const load = () => {
    Sentry.lazyLoadIntegration('replayIntegration')
      .then((replayIntegration) => {
        Sentry.getClient()?.addIntegration(replayIntegration())
      })
      .catch(() => {
        // Replay is diagnostics-only — failing to load it must never surface
        // to the user or break the page.
      })
  }

  const idle = (window as Window).requestIdleCallback
  if (typeof idle === 'function') {
    idle.call(window, load)
  } else {
    setTimeout(load, 2_000)
  }
}
