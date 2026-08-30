import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { resetDb, testPrisma } from "./helpers.js";
import { createFixtures } from "./fixtures.js";

describe("bevegelser", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer({ krevAuth: false });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await testPrisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it("oppretter en bevegelse og lister den filtrert på variant", async () => {
    const { variant, lokasjon, kontekst, bruker } = await createFixtures(app);

    const createRes = await app.inject({
      method: "POST",
      url: "/api/bevegelser",
      payload: {
        variantId: variant.id,
        lokasjonId: lokasjon.id,
        kontekstId: kontekst.id,
        brukerId: bruker.id,
        type: "inn",
        antall: 10,
      },
    });
    expect(createRes.statusCode).toBe(201);

    const listRes = await app.inject({
      method: "GET",
      url: `/api/bevegelser?variantId=${variant.id}`,
    });
    expect(listRes.statusCode).toBe(200);
    const list = listRes.json();
    expect(list).toHaveLength(1);
    expect(list[0].antall).toBe(10);
    expect(list[0].type).toBe("inn");
  });

  it("avviser bevegelse med manglende felt med 400", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/bevegelser",
      payload: { type: "inn" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("avviser bevegelse med referanse til ukjent variant med feil", async () => {
    const { lokasjon, kontekst, bruker } = await createFixtures(app);

    const res = await app.inject({
      method: "POST",
      url: "/api/bevegelser",
      payload: {
        variantId: "00000000-0000-0000-0000-000000000000",
        lokasjonId: lokasjon.id,
        kontekstId: kontekst.id,
        brukerId: bruker.id,
        type: "inn",
        antall: 1,
      },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
  });
});
