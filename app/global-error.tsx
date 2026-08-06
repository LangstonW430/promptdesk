'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

// Catches errors thrown outside any route segment's own error.tsx (e.g. in
// the root layout). Must render its own <html>/<body> since it replaces the
// root layout entirely.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '96px 24px', textAlign: 'center', fontFamily: 'system-ui, sans-serif' }}>
          <p style={{ fontSize: '14px', fontWeight: 500 }}>Something went wrong</p>
          <p style={{ fontSize: '14px', color: '#6b7280' }}>Please try again.</p>
          <button
            onClick={() => reset()}
            style={{ fontSize: '14px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: 'transparent', cursor: 'pointer' }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  )
}
