import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["lib/rules/**"],
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
});
