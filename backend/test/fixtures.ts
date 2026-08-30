import type { FastifyInstance } from "fastify";

/** Oppretter minimum av referansedata som kreves for å registrere en Bevegelse. */
export async function createFixtures(app: FastifyInstance) {
  const leverandorRes = await app.inject({
    method: "POST",
    url: "/api/leverandorer",
    payload: { navn: "Test AS" },
  });
  const leverandor = leverandorRes.json();

  const vareRes = await app.inject({
    method: "POST",
    url: "/api/varer",
    payload: { navn: "Kopp", kategori: "Servise", leverandorId: leverandor.id },
  });
  const vare = vareRes.json();

  const variantRes = await app.inject({
    method: "POST",
    url: "/api/varianter",
    payload: { vareId: vare.id, sku: `KOPP-${Date.now()}-${Math.random()}` },
  });
  const variant = variantRes.json();

  const lokasjonRes = await app.inject({
    method: "POST",
    url: "/api/lokasjoner",
    payload: { navn: "Lager", type: "lager" },
  });
  const lokasjon = lokasjonRes.json();

  const kontekstRes = await app.inject({
    method: "POST",
    url: "/api/kontekster",
    payload: { type: "internbruk", navn: "Test" },
  });
  const kontekst = kontekstRes.json();

  const brukerRes = await app.inject({
    method: "POST",
    url: "/api/brukere",
    payload: { navn: "Test Bruker", rolle: "admin" },
  });
  const bruker = brukerRes.json();

  return { leverandor, vare, variant, lokasjon, kontekst, bruker };
}
