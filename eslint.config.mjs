import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
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
    },
  },
]);

export default eslintConfig;
