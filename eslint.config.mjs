import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "lib/data/**", "node_modules/**", ".scratch/**", "test-results/**", "playwright-report/**", "reports/**", ".lighthouseci/**"]),
  // Playwright fixtures receive a `use` callback that is not React's use().
  { files: ["e2e/**/*.ts"], rules: { "react-hooks/rules-of-hooks": "off" } },
]);

export default eslintConfig;
