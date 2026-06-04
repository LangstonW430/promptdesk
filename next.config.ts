import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  reactCompiler: true,
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
