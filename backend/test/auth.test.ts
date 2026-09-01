import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../src/server.js";
import { resetDb, testPrisma, STANDARD_BEDRIFT_ID } from "./helpers.js";

// Egen suite som kjorer MED innloggingskrav pa (i motsetning til de ovrige
// testene som bygger serveren med krevAuth: false).
describe("auth", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildServer({ krevAuth: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
    await testPrisma.$disconnect();
  });

  beforeEach(async () => {
    await resetDb();
  });

  it("avviser beskyttet endepunkt uten token", async () => {
    const res = await app.inject({ method: "GET", url: "/api/varer" });
    expect(res.statusCode).toBe(401);
  });

  it("slipper gjennom apne stier uten token", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
  });

  it("nekter registrering for en e-post som ikke er invitert", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/registrer",
      payload: { epost: "ukjent@example.com", passord: "passord123", navn: "Ukjent" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("lar en invitert e-post registrere seg, logge inn og na beskyttede endepunkt", async () => {
    await testPrisma.invitertEpost.create({
      data: { epost: "ansatt@example.com", rolle: "ansatt", bedriftId: STANDARD_BEDRIFT_ID },
    });

    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/registrer",
      payload: { epost: "ansatt@example.com", passord: "passord123", navn: "Kari" },
    });
    expect(reg.statusCode).toBe(201);
    const { token } = reg.json();
    expect(typeof token).toBe("string");

    // Invitasjonen kan ikke brukes to ganger.
    const reg2 = await app.inject({
      method: "POST",
      url: "/api/auth/registrer",
      payload: { epost: "ansatt@example.com", passord: "passord123", navn: "Kari" },
    });
    expect(reg2.statusCode).toBe(403);

    const feilPassord = await app.inject({
      method: "POST",
      url: "/api/auth/logg-inn",
      payload: { epost: "ansatt@example.com", passord: "feil" },
    });
    expect(feilPassord.statusCode).toBe(401);

    const inn = await app.inject({
      method: "POST",
      url: "/api/auth/logg-inn",
      payload: { epost: "ansatt@example.com", passord: "passord123" },
    });
    expect(inn.statusCode).toBe(200);
    const innToken = inn.json().token as string;

    const varer = await app.inject({
      method: "GET",
      url: "/api/varer",
      headers: { authorization: `Bearer ${innToken}` },
    });
    expect(varer.statusCode).toBe(200);
  });

  it("lar en vanlig ansatt endre bedriften (ikke lenger admin-only)", async () => {
    await testPrisma.invitertEpost.create({
      data: { epost: "ansatt3@example.com", rolle: "ansatt", bedriftId: STANDARD_BEDRIFT_ID },
    });
    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/registrer",
      payload: { epost: "ansatt3@example.com", passord: "passord123", navn: "Per" },
    });
    const token = reg.json().token as string;

    const res = await app.inject({
      method: "PATCH",
      url: "/api/bedrift",
      headers: { authorization: `Bearer ${token}` },
      payload: { navn: "Nytt Navn AS" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().navn).toBe("Nytt Navn AS");
  });

  it("global admin (superadmin) er admin i alle bedrifter", async () => {
    const annen = await testPrisma.bedrift.create({ data: { navn: "Annen Bedrift AS" } });
    await testPrisma.invitertEpost.create({
      data: { epost: "sjef@example.com", rolle: "ansatt", bedriftId: STANDARD_BEDRIFT_ID },
    });
    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/registrer",
      payload: { epost: "sjef@example.com", passord: "passord123", navn: "Sjef" },
    });
    const brukerId = reg.json().bruker.id as string;
    await testPrisma.bruker.update({ where: { id: brukerId }, data: { superadmin: true } });

    const inn = await app.inject({
      method: "POST",
      url: "/api/auth/logg-inn",
      payload: { epost: "sjef@example.com", passord: "passord123" },
    });
    const token = inn.json().token as string;
    // Ser alle bedrifter, alltid som admin.
    expect(inn.json().bedrifter).toHaveLength(2);
    expect(inn.json().bedrifter.every((b: { rolle: string }) => b.rolle === "admin")).toBe(true);

    // Kan operere i en bedrift den ikke er medlem av, som admin.
    const adminEndepunkt = await app.inject({
      method: "GET",
      url: "/api/inviterte",
      headers: { authorization: `Bearer ${token}`, "x-bedrift-id": annen.id },
    });
    expect(adminEndepunkt.statusCode).toBe(200);
  });

  it("krever admin-rolle for tillatslisten", async () => {
    await testPrisma.invitertEpost.create({
      data: { epost: "ansatt2@example.com", rolle: "ansatt", bedriftId: STANDARD_BEDRIFT_ID },
    });
    const reg = await app.inject({
      method: "POST",
      url: "/api/auth/registrer",
      payload: { epost: "ansatt2@example.com", passord: "passord123", navn: "Ola" },
    });
    const token = reg.json().token as string;

    const nektet = await app.inject({
      method: "GET",
      url: "/api/inviterte",
      headers: { authorization: `Bearer ${token}` },
    });
    expect(nektet.statusCode).toBe(403);
  });
});
