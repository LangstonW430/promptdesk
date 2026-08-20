import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    // The E2E harness builds into its own directory so a test run cannot
    // collide with a running `npm run dev`.
    ".next-e2e/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // The codebase intentionally uses useEffect(() => { setState(prop) }, [prop])
      // for prop-sync patterns (SSR hydration guards, optimistic-UI reconciliation
      // after server revalidation). Turning this off avoids scatter-gun disable
      // comments across the component layer.
      "react-hooks/set-state-in-effect": "off",
      // Allow _-prefixed variables as intentional discards (e.g. destructuring to
      // exclude a key from a rest spread: const { excluded: _x, ...rest } = obj).
      "@typescript-eslint/no-unused-vars": ["warn", {
        args: "after-used",
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        ignoreRestSiblings: true,
      }],
    },
  },
]);

export default eslintConfig;
