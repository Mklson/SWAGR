import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { resetDb, testPrisma } from "./helpers.js";
import { createFixtures } from "./fixtures.js";

describe("merker", () => {
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

  it("oppretter og lister merker", async () => {
    const createRes = await app.inject({
      method: "POST",
      url: "/api/merker",
      payload: { navn: "Acme Events", logoUrl: "https://example.com/logo.png" },
    });
    expect(createRes.statusCode).toBe(201);

    const listRes = await app.inject({ method: "GET", url: "/api/merker" });
    const liste = listRes.json();
    expect(liste).toHaveLength(1);
    expect(liste[0].navn).toBe("Acme Events");
  });

  it("kobler en variant til et merke og oppdaterer verdi via PATCH", async () => {
    const { variant } = await createFixtures(app);
    const merkeRes = await app.inject({
      method: "POST",
      url: "/api/merker",
      payload: { navn: "Nordic Brand" },
    });
    const merke = merkeRes.json();

    const patchRes = await app.inject({
      method: "PATCH",
      url: `/api/varianter/${variant.id}`,
      payload: { merkeId: merke.id, verdiOre: 15000 },
    });
    expect(patchRes.statusCode).toBe(200);
    const oppdatert = patchRes.json();
    expect(oppdatert.merkeId).toBe(merke.id);
    expect(oppdatert.verdiOre).toBe(15000);
  });

  it("returnerer 404 ved oppdatering av ukjent variant", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/varianter/00000000-0000-0000-0000-000000000000",
      payload: { verdiOre: 100 },
    });
    expect(res.statusCode).toBe(404);
  });
});
