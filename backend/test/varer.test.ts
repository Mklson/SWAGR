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

  it("sletter en artikkel med variantene under den", async () => {
    const vare = await lagVare();
    await app.inject({
      method: "POST",
      url: "/api/varianter",
      payload: { vareId: vare.id, sku: "SLETT-1" },
    });

    const del = await app.inject({ method: "DELETE", url: `/api/varer/${vare.id}` });
    expect(del.statusCode).toBe(204);

    const liste = (await app.inject({ method: "GET", url: "/api/varer" })).json();
    expect(liste).toHaveLength(0);
    const varianter = (await app.inject({ method: "GET", url: "/api/varianter" })).json();
    expect(varianter).toHaveLength(0);
  });

  it("blokkerer sletting av en artikkel som har bevegelser (409)", async () => {
    const vare = await lagVare();
    const variant = (
      await app.inject({
        method: "POST",
        url: "/api/varianter",
        payload: { vareId: vare.id, sku: "IBRUK-1" },
      })
    ).json();
    const lokasjon = (
      await app.inject({
        method: "POST",
        url: "/api/lokasjoner",
        payload: { navn: "Lager", type: "lager" },
      })
    ).json();
    const bruker = (
      await app.inject({
        method: "POST",
        url: "/api/brukere",
        payload: { navn: "Ola", rolle: "ansatt" },
      })
    ).json();
    await app.inject({
      method: "POST",
      url: "/api/bevegelser",
      payload: {
        variantId: variant.id,
        lokasjonId: lokasjon.id,
        brukerId: bruker.id,
        type: "inn",
        antall: 5,
      },
    });

    const del = await app.inject({ method: "DELETE", url: `/api/varer/${vare.id}` });
    expect(del.statusCode).toBe(409);

    const delVariant = await app.inject({ method: "DELETE", url: `/api/varianter/${variant.id}` });
    expect(delVariant.statusCode).toBe(409);
  });

  it("sletter en enkelt variant uten bevegelser", async () => {
    const vare = await lagVare();
    const variant = (
      await app.inject({
        method: "POST",
        url: "/api/varianter",
        payload: { vareId: vare.id, sku: "FRI-1" },
      })
    ).json();

    const del = await app.inject({ method: "DELETE", url: `/api/varianter/${variant.id}` });
    expect(del.statusCode).toBe(204);
  });
});
