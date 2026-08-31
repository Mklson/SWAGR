import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { resetDb, testPrisma } from "./helpers.js";

describe("varer", () => {
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

  async function lagVare() {
    const lev = (
      await app.inject({ method: "POST", url: "/api/leverandorer", payload: { navn: "Lev AS" } })
    ).json();
    return (
      await app.inject({
        method: "POST",
        url: "/api/varer",
        payload: { navn: "Vinglass", kategori: "Glass", leverandorId: lev.id },
      })
    ).json();
  }

  it("oppdaterer navn og kategori via PATCH", async () => {
    const vare = await lagVare();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/varer/${vare.id}`,
      payload: { navn: "Champagneglass", kategori: "Barutstyr" },
    });
    expect(res.statusCode).toBe(200);
    const oppdatert = res.json();
    expect(oppdatert.navn).toBe("Champagneglass");
    expect(oppdatert.kategori).toBe("Barutstyr");
  });

  it("returnerer 404 for ukjent vare", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/api/varer/00000000-0000-0000-0000-000000000000",
      payload: { navn: "X" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("avviser ugyldig kropp", async () => {
    const vare = await lagVare();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/varer/${vare.id}`,
      payload: { navn: "" },
    });
    expect(res.statusCode).toBe(400);
  });
});
