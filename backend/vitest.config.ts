import { defineConfig } from "vitest/config";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://artkl:artkl@localhost:5433/artkl_test?schema=public";

export default defineConfig({
  test: {
    environment: "node",
    globalSetup: "./test/globalSetup.ts",
    env: {
      DATABASE_URL: TEST_DATABASE_URL,
    },
    fileParallelism: false,
  },
});
