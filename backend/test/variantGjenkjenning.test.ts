import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { resetDb, testPrisma } from "./helpers.js";

describe("varianter/gjenkjenn", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await testPrisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it("returnerer 400 ved manglende felt", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/varianter/gjenkjenn",
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it("returnerer 400 for ustøttet mediaType (f.eks. PDF)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/varianter/gjenkjenn",
      payload: { fil: "abc", mediaType: "application/pdf" },
    });
    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!!process.env.ANTHROPIC_API_KEY)(
    "returnerer 503 når ANTHROPIC_API_KEY mangler",
    async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/varianter/gjenkjenn",
        payload: { fil: "abc", mediaType: "image/png" },
      });
      expect(res.statusCode).toBe(503);
    },
  );
});
