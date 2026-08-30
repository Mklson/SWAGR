import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { resetDb, testPrisma } from "./helpers.js";
import { createFixtures } from "./fixtures.js";

describe("rapporter", () => {
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

  async function bevegelse(
    app: FastifyInstance,
    fixtures: Awaited<ReturnType<typeof createFixtures>>,
    type: string,
    antall: number,
    tidspunkt?: string,
  ) {
    const res = await app.inject({
      method: "POST",
      url: "/api/bevegelser",
      payload: {
        variantId: fixtures.variant.id,
        lokasjonId: fixtures.lokasjon.id,
        kontekstId: fixtures.kontekst.id,
        brukerId: fixtures.bruker.id,
        type,
        antall,
        ...(tidspunkt ? { tidspunkt } : {}),
      },
    });
    expect(res.statusCode).toBe(201);
  }

  it("summerer bevegelser per variant+type for en gitt kontekst", async () => {
    const fixtures = await createFixtures(app);
    await bevegelse(app, fixtures, "ut", 30);
    await bevegelse(app, fixtures, "ut", 20);
    await bevegelse(app, fixtures, "retur", 5);

    const res = await app.inject({
      method: "GET",
      url: `/api/rapporter/kontekst/${fixtures.kontekst.id}`,
    });
    expect(res.statusCode).toBe(200);
    const rader = res.json();
    expect(rader).toEqual(
      expect.arrayContaining([
        { variantId: fixtures.variant.id, type: "ut", antall: 50, verdiOre: 0, antallMedVerdi: 0 },
        { variantId: fixtures.variant.id, type: "retur", antall: 5, verdiOre: 0, antallMedVerdi: 0 },
      ]),
    );
  });

  it("filtrerer kontekst-rapport på periode", async () => {
    const fixtures = await createFixtures(app);
    await bevegelse(app, fixtures, "ut", 10, "2025-01-01T00:00:00.000Z");
    await bevegelse(app, fixtures, "ut", 100, "2026-06-01T00:00:00.000Z");

    const res = await app.inject({
      method: "GET",
      url: `/api/rapporter/kontekst/${fixtures.kontekst.id}?fra=2026-01-01&til=2026-12-31`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      { variantId: fixtures.variant.id, type: "ut", antall: 100, verdiOre: 0, antallMedVerdi: 0 },
    ]);
  });

  it("låser verdi til prisen på registreringstidspunktet, ikke dagens pris", async () => {
    const fixtures = await createFixtures(app);

    await app.inject({
      method: "PATCH",
      url: `/api/varianter/${fixtures.variant.id}`,
      payload: { verdiOre: 10000 },
    });
    await bevegelse(app, fixtures, "ut", 5); // 5 stk à 100 kr da dette skjedde

    await app.inject({
      method: "PATCH",
      url: `/api/varianter/${fixtures.variant.id}`,
      payload: { verdiOre: 20000 },
    });
    await bevegelse(app, fixtures, "ut", 3); // 3 stk à 200 kr - prisen endret seg i mellomtiden

    const res = await app.inject({
      method: "GET",
      url: `/api/rapporter/kontekst/${fixtures.kontekst.id}`,
    });
    expect(res.statusCode).toBe(200);
    const [rad] = res.json();
    // Riktig svar er 5*10000 + 3*20000 = 110000 - IKKE 8*20000 (dagens pris)
    expect(rad.antall).toBe(8);
    expect(rad.antallMedVerdi).toBe(8);
    expect(rad.verdiOre).toBe(110000);
  });

  it("fleksibel rapport: ett merke på tvers av flere kunder, én kunde på tvers av flere merker, og uten filter", async () => {
    const { lokasjon, bruker, vare } = await createFixtures(app);

    // To merker, to kontekster (kunder), to varianter (én per merke), krysset:
    // merkeA -> kundeA (10 stk) og kundeB (5 stk); merkeB -> kundeA (7 stk).
    const merkeA = (await app.inject({ method: "POST", url: "/api/merker", payload: { navn: "MerkeA" } })).json();
    const merkeB = (await app.inject({ method: "POST", url: "/api/merker", payload: { navn: "MerkeB" } })).json();
    const kundeA = (
      await app.inject({ method: "POST", url: "/api/kontekster", payload: { type: "kunde", navn: "KundeA" } })
    ).json();
    const kundeB = (
      await app.inject({ method: "POST", url: "/api/kontekster", payload: { type: "kunde", navn: "KundeB" } })
    ).json();
    const variantA = (
      await app.inject({
        method: "POST",
        url: "/api/varianter",
        payload: { vareId: vare.id, sku: `A-${Date.now()}`, merkeId: merkeA.id },
      })
    ).json();
    const variantB = (
      await app.inject({
        method: "POST",
        url: "/api/varianter",
        payload: { vareId: vare.id, sku: `B-${Date.now()}`, merkeId: merkeB.id },
      })
    ).json();

    async function ut(variantId: string, kontekstId: string, antall: number) {
      const res = await app.inject({
        method: "POST",
        url: "/api/bevegelser",
        payload: { variantId, lokasjonId: lokasjon.id, kontekstId, brukerId: bruker.id, type: "ut", antall },
      });
      expect(res.statusCode).toBe(201);
    }
    await ut(variantA.id, kundeA.id, 10);
    await ut(variantA.id, kundeB.id, 5);
    await ut(variantB.id, kundeA.id, 7);

    // Ett merke, alle kunder -> ser begge kundene for merkeA, ikke merkeB.
    const perMerke = await app.inject({ method: "GET", url: `/api/rapporter/fleksibel?merkeId=${merkeA.id}` });
    expect(perMerke.statusCode).toBe(200);
    const perMerkeRader = perMerke.json();
    expect(perMerkeRader).toHaveLength(2);
    expect(perMerkeRader.every((r: { merkeId: string }) => r.merkeId === merkeA.id)).toBe(true);
    expect(perMerkeRader.reduce((s: number, r: { antall: number }) => s + r.antall, 0)).toBe(15);

    // Én kunde, alle merker -> ser begge merkene for kundeA, ikke kundeB.
    const perKunde = await app.inject({ method: "GET", url: `/api/rapporter/fleksibel?kontekstId=${kundeA.id}` });
    expect(perKunde.statusCode).toBe(200);
    const perKundeRader = perKunde.json();
    expect(perKundeRader).toHaveLength(2);
    expect(perKundeRader.every((r: { kontekstId: string }) => r.kontekstId === kundeA.id)).toBe(true);
    expect(perKundeRader.reduce((s: number, r: { antall: number }) => s + r.antall, 0)).toBe(17);

    // Ingen filter -> alt, tre grupper.
    const alt = await app.inject({ method: "GET", url: "/api/rapporter/fleksibel" });
    expect(alt.statusCode).toBe(200);
    expect(alt.json()).toHaveLength(3);
  });

  it("summerer bevegelser per type for en periode, filtrerbart på lokasjon", async () => {
    const fixtures = await createFixtures(app);
    await bevegelse(app, fixtures, "svinn", 3);
    await bevegelse(app, fixtures, "svinn", 4);
    await bevegelse(app, fixtures, "inn", 50);

    const res = await app.inject({
      method: "GET",
      url: `/api/rapporter/periode?lokasjonId=${fixtures.lokasjon.id}`,
    });
    expect(res.statusCode).toBe(200);
    const rader = res.json();
    expect(rader).toEqual(
      expect.arrayContaining([
        { type: "svinn", antall: 7, verdiOre: 0, antallMedVerdi: 0 },
        { type: "inn", antall: 50, verdiOre: 0, antallMedVerdi: 0 },
      ]),
    );
  });

  it("periode-rapport inkluderer verdi, låst til registreringstidspunktet", async () => {
    const fixtures = await createFixtures(app);
    await app.inject({
      method: "PATCH",
      url: `/api/varianter/${fixtures.variant.id}`,
      payload: { verdiOre: 5000 },
    });
    await bevegelse(app, fixtures, "ut", 4); // 4 stk à 50 kr

    const res = await app.inject({
      method: "GET",
      url: `/api/rapporter/periode?lokasjonId=${fixtures.lokasjon.id}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([{ type: "ut", antall: 4, verdiOre: 20000, antallMedVerdi: 4 }]);
  });
});
