import { fileURLToPath, URL } from "node:url"

import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./resources/js", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/frontend/**/*.test.ts"],
    coverage: {
      reporter: ["text", "json-summary"],
    },
  },
})
