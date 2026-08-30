import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { resetDb, testPrisma } from "./helpers.js";
import { createFixtures } from "./fixtures.js";

describe("rapporter/sporsmal", () => {
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

  it("returnerer 400 for tomt spørsmål", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/rapporter/sporsmal",
      payload: { sporsmal: "" },
    });
    expect(res.statusCode).toBe(400);
  });

  it.skipIf(!!process.env.ANTHROPIC_API_KEY)(
    "returnerer 503 når ANTHROPIC_API_KEY mangler",
    async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/rapporter/sporsmal",
        payload: { sporsmal: "Hvor mye leverte vi til Acme i år?" },
      });
      expect(res.statusCode).toBe(503);
    },
  );

  it.skipIf(!process.env.ANTHROPIC_API_KEY)(
    "besvarer et spørsmål om leveranser til en kunde ved å slå opp kontekst og summere bevegelser",
    async () => {
      const fixtures = await createFixtures(app);
      await testPrisma.kontekst.update({
        where: { id: fixtures.kontekst.id },
        data: { navn: "Acme Events", type: "kunde" },
      });

      await app.inject({
        method: "POST",
        url: "/api/bevegelser",
        payload: {
          variantId: fixtures.variant.id,
          lokasjonId: fixtures.lokasjon.id,
          kontekstId: fixtures.kontekst.id,
          brukerId: fixtures.bruker.id,
          type: "ut",
          antall: 42,
        },
      });

      const res = await app.inject({
        method: "POST",
        url: "/api/rapporter/sporsmal",
        payload: { sporsmal: "Hvor mange enheter har vi levert til Acme Events?" },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.svar).toContain("42");
      expect(body.verktoyKall.length).toBeGreaterThan(0);
    },
    30000,
  );
});
