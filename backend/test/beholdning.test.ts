import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { resetDb, testPrisma } from "./helpers.js";
import { createFixtures } from "./fixtures.js";

describe("beholdning", () => {
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

  it("beregner beholdning riktig på tvers av bevegelsestyper", async () => {
    const { variant, lokasjon, kontekst, bruker } = await createFixtures(app);

    async function bevegelse(type: string, antall: number) {
      const res = await app.inject({
        method: "POST",
        url: "/api/bevegelser",
        payload: {
          variantId: variant.id,
          lokasjonId: lokasjon.id,
          kontekstId: kontekst.id,
          brukerId: bruker.id,
          type,
          antall,
        },
      });
      expect(res.statusCode).toBe(201);
    }

    await bevegelse("inn", 100);
    await bevegelse("ut", 30);
    await bevegelse("svinn", 5);
    await bevegelse("retur", 10);
    await bevegelse("internbruk", 2);

    const res = await app.inject({
      method: "GET",
      url: `/api/beholdning?variantId=${variant.id}&lokasjonId=${lokasjon.id}`,
    });
    expect(res.statusCode).toBe(200);
    const rader = res.json();
    expect(rader).toHaveLength(1);
    expect(rader[0].beholdning).toBe(100 - 30 - 5 + 10 - 2);
  });

  it("returnerer tom liste når ingen bevegelser finnes for variant", async () => {
    const { variant } = await createFixtures(app);

    const res = await app.inject({
      method: "GET",
      url: `/api/beholdning?variantId=${variant.id}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});
