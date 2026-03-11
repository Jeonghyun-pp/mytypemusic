import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    include: ["src/lib/**/__tests__/*.test.ts", "src/lib/__tests__/*.test.ts"],
    environment: "node",
    env: {
      DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://unused:unused@localhost:5432/unused",
      OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? "sk-test-dummy-key-for-ci",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
