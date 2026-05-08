import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  resolve: {
    alias: {
      shared: resolve(__dirname, "shared"),
    },
  },
  test: {
    environment: "node",
    include: [
      "**/*.test.ts",
      "tests/**/*.test.ts",
    ],
    exclude: [
      "node_modules",
      "dist",
      "runtime/src/**",
    ],
  },
});
