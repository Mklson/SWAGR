import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const backendDir = fileURLToPath(new URL("..", import.meta.url));

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "postgresql://artkl:artkl@localhost:5433/artkl_test?schema=public";

export default async function globalSetup() {
  execSync("npx prisma migrate deploy", {
    cwd: backendDir,
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL, DIRECT_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
