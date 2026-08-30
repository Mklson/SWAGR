import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { resetDb, testPrisma } from "./helpers.js";
import { createFixtures } from "./fixtures.js";

describe("reservasjoner", () => {
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

  async function leggInnBeholdning(app: FastifyInstance, variant: any, lokasjon: any, kontekst: any, bruker: any, antall: number) {
    return app.inject({
      method: "POST",
      url: "/api/bevegelser",
      payload: { variantId: variant.id, lokasjonId: lokasjon.id, kontekstId: kontekst.id, brukerId: bruker.id, type: "inn", antall },
    });
  }

  it("oppretter en reservasjon og trekker den fra tilgjengelig beholdning", async () => {
    const { variant, lokasjon, kontekst, bruker } = await createFixtures(app);
    await leggInnBeholdning(app, variant, lokasjon, kontekst, bruker, 100);

    const res = await app.inject({
      method: "POST",
      url: "/api/reservasjoner",
      payload: { variantId: variant.id, lokasjonId: lokasjon.id, kontekstId: kontekst.id, brukerId: bruker.id, antall: 40 },
    });
    expect(res.statusCode).toBe(201);

    const beholdningRes = await app.inject({
      method: "GET",
      url: `/api/beholdning?variantId=${variant.id}&lokasjonId=${lokasjon.id}`,
    });
    const [rad] = beholdningRes.json();
    expect(rad.beholdning).toBe(100);
    expect(rad.reservert).toBe(40);
    expect(rad.tilgjengelig).toBe(60);
  });

  it("avviser reservasjon som overstiger tilgjengelig beholdning", async () => {
    const { variant, lokasjon, kontekst, bruker } = await createFixtures(app);
    await leggInnBeholdning(app, variant, lokasjon, kontekst, bruker, 50);

    const res = await app.inject({
      method: "POST",
      url: "/api/reservasjoner",
      payload: { variantId: variant.id, lokasjonId: lokasjon.id, kontekstId: kontekst.id, brukerId: bruker.id, antall: 51 },
    });
    expect(res.statusCode).toBe(409);
  });

  it("blokkerer en ut-bevegelse som ville spist av reservert antall", async () => {
    const { variant, lokasjon, kontekst, bruker } = await createFixtures(app);
    await leggInnBeholdning(app, variant, lokasjon, kontekst, bruker, 100);
    await app.inject({
      method: "POST",
      url: "/api/reservasjoner",
      payload: { variantId: variant.id, lokasjonId: lokasjon.id, kontekstId: kontekst.id, brukerId: bruker.id, antall: 100 },
    });

    const utRes = await app.inject({
      method: "POST",
      url: "/api/bevegelser",
      payload: { variantId: variant.id, lokasjonId: lokasjon.id, kontekstId: kontekst.id, brukerId: bruker.id, type: "ut", antall: 1 },
    });
    expect(utRes.statusCode).toBe(409);
  });

  it("tillater ut-bevegelse innenfor det som ikke er reservert", async () => {
    const { variant, lokasjon, kontekst, bruker } = await createFixtures(app);
    await leggInnBeholdning(app, variant, lokasjon, kontekst, bruker, 100);
    await app.inject({
      method: "POST",
      url: "/api/reservasjoner",
      payload: { variantId: variant.id, lokasjonId: lokasjon.id, kontekstId: kontekst.id, brukerId: bruker.id, antall: 40 },
    });

    const utRes = await app.inject({
      method: "POST",
      url: "/api/bevegelser",
      payload: { variantId: variant.id, lokasjonId: lokasjon.id, kontekstId: kontekst.id, brukerId: bruker.id, type: "ut", antall: 60 },
    });
    expect(utRes.statusCode).toBe(201);
  });

  it("kansellering frigir blokkert beholdning igjen", async () => {
    const { variant, lokasjon, kontekst, bruker } = await createFixtures(app);
    await leggInnBeholdning(app, variant, lokasjon, kontekst, bruker, 100);
    const reservasjonRes = await app.inject({
      method: "POST",
      url: "/api/reservasjoner",
      payload: { variantId: variant.id, lokasjonId: lokasjon.id, kontekstId: kontekst.id, brukerId: bruker.id, antall: 100 },
    });
    const reservasjon = reservasjonRes.json();

    const kansellerRes = await app.inject({
      method: "POST",
      url: `/api/reservasjoner/${reservasjon.id}/kanseller`,
    });
    expect(kansellerRes.statusCode).toBe(200);

    const utRes = await app.inject({
      method: "POST",
      url: "/api/bevegelser",
      payload: { variantId: variant.id, lokasjonId: lokasjon.id, kontekstId: kontekst.id, brukerId: bruker.id, type: "ut", antall: 100 },
    });
    expect(utRes.statusCode).toBe(201);
  });
});
