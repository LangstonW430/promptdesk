import path from 'path'
import { defineConfig } from 'vitest/config'

/**
 * The end-to-end suite: real HTTP against the real app against real Postgres.
 *
 * Kept separate from vitest.config.ts because the two have almost nothing in
 * common — these tests need a stack brought up before them, take seconds each
 * rather than milliseconds, and must not run concurrently. `npm run test`
 * stays as fast as it was.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'node',
    include: ['e2e/specs/**/*.e2e.ts'],
    globalSetup: ['e2e/harness/global-setup.ts'],
    setupFiles: ['e2e/harness/setup-file.ts'],

    // Every test truncates the database before it runs, so nothing may overlap
    // with anything else — not across files, not within one.
    fileParallelism: false,
    pool: 'threads',
    maxWorkers: 1,

    // Bringing up Postgres, the Auth stub and a Next dev server takes a while,
    // and the first request to each route pays for compiling it.
    hookTimeout: 240_000,
    testTimeout: 60_000,
  },
})
