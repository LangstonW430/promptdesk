import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // The E2E harness starts its own dev server. Without a separate build
  // directory it would share `.next` with whatever `npm run dev` the developer
  // already has running, and the two would overwrite each other's output.
  // Unset everywhere else, so the default `.next` is used.
  ...(process.env.E2E_DIST_DIR ? { distDir: process.env.E2E_DIST_DIR } : {}),
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Upload source maps to Sentry at build time for readable stack traces.
  // Requires SENTRY_AUTH_TOKEN in the environment (set in CI / Vercel env vars).
  silent: !process.env.CI,

  webpack: {
    // Tree-shake Sentry debug logging from the browser bundle.
    treeshake: { removeDebugLogging: true },
    // Automatically instrument Next.js data fetching methods and route handlers.
    autoInstrumentServerFunctions: true,
  },
});
