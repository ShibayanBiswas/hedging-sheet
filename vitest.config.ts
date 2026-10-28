import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    // Component tests opt into jsdom with a @vitest-environment docblock.
    environment: "node",
    setupFiles: ["tests/helpers/setup.ts"],
    testTimeout: 60_000,
    hookTimeout: 180_000,
    reporters: process.env.CI ? ["default", "junit"] : ["default"],
    outputFile: { junit: "test-results/vitest-junit.xml" },
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "html", "lcov"],
      reportsDirectory: "test-results/coverage",
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
      exclude: [
        "lib/engine/types.ts",
        "lib/context/**",
        "lib/hooks/**",
        "lib/motion.ts",
        "lib/navigation.ts",
        "lib/cn.ts",
        "lib/workbook/excel-runtime.ts",
        "lib/workbook/export-branding.ts",
        "lib/workbook/export-filename.ts",
        "lib/desk-alert.ts",
      ],
      thresholds: {
        lines: 80,
        "lib/engine/**": { lines: 90 },
      },
    },
  },
});
