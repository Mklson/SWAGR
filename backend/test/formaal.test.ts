import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { resetDb, testPrisma } from "./helpers.js";
import { createFixtures } from "./fixtures.js";

describe("formaal", () => {
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

  it("oppretter og lister formål", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/formaal",
      payload: { navn: "Festival" },
    });
    expect(res.statusCode).toBe(201);
    const liste = (await app.inject({ method: "GET", url: "/api/formaal" })).json();
    expect(liste.map((f: { navn: string }) => f.navn)).toContain("Festival");
  });

  it("registrerer en bevegelse med formål og uten kontekst", async () => {
    const { variant, lokasjon, bruker } = await createFixtures(app);
    const formaal = (
      await app.inject({ method: "POST", url: "/api/formaal", payload: { navn: "Messe" } })
    ).json();

    const res = await app.inject({
      method: "POST",
      url: "/api/bevegelser",
      payload: {
        variantId: variant.id,
        lokasjonId: lokasjon.id,
        brukerId: bruker.id,
        formaalId: formaal.id,
        type: "ut",
        antall: 3,
      },
    });
    expect(res.statusCode).toBe(201);
    const b = res.json();
    expect(b.formaalId).toBe(formaal.id);
    expect(b.kontekstId).toBeNull();
  });
});
