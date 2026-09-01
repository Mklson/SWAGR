import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { resetDb, testPrisma } from "./helpers.js";

describe("oppsett CRUD (rediger/slett)", () => {
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

  it("oppdaterer og sletter en leverandør", async () => {
    const lev = (
      await app.inject({ method: "POST", url: "/api/leverandorer", payload: { navn: "Lev AS" } })
    ).json();

    const patch = await app.inject({
      method: "PATCH",
      url: `/api/leverandorer/${lev.id}`,
      payload: { navn: "Lev Endret AS" },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().navn).toBe("Lev Endret AS");

    const del = await app.inject({ method: "DELETE", url: `/api/leverandorer/${lev.id}` });
    expect(del.statusCode).toBe(204);

    const liste = (await app.inject({ method: "GET", url: "/api/leverandorer" })).json();
    expect(liste).toHaveLength(0);
  });

  it("oppdaterer navn og logo på et merke, og fjerner logo med null", async () => {
    const merke = (
      await app.inject({ method: "POST", url: "/api/merker", payload: { navn: "Acme" } })
    ).json();

    const patch = await app.inject({
      method: "PATCH",
      url: `/api/merker/${merke.id}`,
      payload: { navn: "Acme Events", logoUrl: "https://example.com/logo.png" },
    });
    expect(patch.statusCode).toBe(200);
    expect(patch.json().logoUrl).toBe("https://example.com/logo.png");

    const fjern = await app.inject({
      method: "PATCH",
      url: `/api/merker/${merke.id}`,
      payload: { logoUrl: null },
    });
    expect(fjern.statusCode).toBe(200);
    expect(fjern.json().logoUrl).toBeNull();
  });

  it("404 ved oppdatering/sletting av ukjent id", async () => {
    const ukjent = "00000000-0000-0000-0000-000000000000";
    const patch = await app.inject({
      method: "PATCH",
      url: `/api/formaal/${ukjent}`,
      payload: { navn: "X" },
    });
    expect(patch.statusCode).toBe(404);
    const del = await app.inject({ method: "DELETE", url: `/api/formaal/${ukjent}` });
    expect(del.statusCode).toBe(404);
  });

  it("409 når man prøver å slette en kunde som er i bruk", async () => {
    const lev = (
      await app.inject({ method: "POST", url: "/api/leverandorer", payload: { navn: "L" } })
    ).json();
    const vare = (
      await app.inject({
        method: "POST",
        url: "/api/varer",
        payload: { navn: "Vare", kategori: "Annet", leverandorId: lev.id },
      })
    ).json();
    const variant = (
      await app.inject({
        method: "POST",
        url: "/api/varianter",
        payload: { vareId: vare.id, sku: "SKU-1" },
      })
    ).json();
    const lokasjon = (
      await app.inject({
        method: "POST",
        url: "/api/lokasjoner",
        payload: { navn: "Lager", type: "lager" },
      })
    ).json();
    const kunde = (
      await app.inject({
        method: "POST",
        url: "/api/kontekster",
        payload: { type: "kunde", navn: "Kunde AS" },
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
        kontekstId: kunde.id,
        brukerId: bruker.id,
        type: "ut",
        antall: 1,
      },
    });

    const del = await app.inject({ method: "DELETE", url: `/api/kontekster/${kunde.id}` });
    expect(del.statusCode).toBe(409);
  });

  it("inngående-rapport summerer varemottak per variant", async () => {
    const lev = (
      await app.inject({ method: "POST", url: "/api/leverandorer", payload: { navn: "L" } })
    ).json();
    const vare = (
      await app.inject({
        method: "POST",
        url: "/api/varer",
        payload: { navn: "Vare", kategori: "Annet", leverandorId: lev.id },
      })
    ).json();
    const variant = (
      await app.inject({
        method: "POST",
        url: "/api/varianter",
        payload: { vareId: vare.id, sku: "SKU-INN", verdiOre: 5000 },
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
    for (const antall of [3, 7]) {
      await app.inject({
        method: "POST",
        url: "/api/bevegelser",
        payload: {
          variantId: variant.id,
          lokasjonId: lokasjon.id,
          brukerId: bruker.id,
          type: "inn",
          antall,
        },
      });
    }
    // En ut-bevegelse skal ikke telle med.
    await app.inject({
      method: "POST",
      url: "/api/bevegelser",
      payload: {
        variantId: variant.id,
        lokasjonId: lokasjon.id,
        brukerId: bruker.id,
        type: "svinn",
        antall: 2,
      },
    });

    const rapport = await app.inject({ method: "GET", url: "/api/rapporter/inngaende" });
    expect(rapport.statusCode).toBe(200);
    const rader = rapport.json();
    expect(rader).toHaveLength(1);
    expect(rader[0].variantId).toBe(variant.id);
    expect(rader[0].antall).toBe(10);
    expect(rader[0].verdiOre).toBe(50000);
  });
});
