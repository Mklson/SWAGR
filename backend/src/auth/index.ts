import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyJwt from "@fastify/jwt";
import { prisma } from "../db/client.js";
import { STANDARD_BEDRIFT_ID } from "../db/systemdata.js";
import { hashPassord } from "./passord.js";

// Stier som er tilgjengelige uten innlogging.
const APNE_STIER = [/^\/health$/, /^\/docs(\/|$)/, /^\/api\/auth\/(logg-inn|registrer)$/];

export interface AuthBruker {
  id: string;
  navn: string;
  epost: string;
}

declare module "fastify" {
  interface FastifyRequest {
    bruker?: AuthBruker;
    // Aktiv bedrift for forespørselen + brukerens rolle i den.
    bedriftId: string;
    rolle: string;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string };
    user: { sub: string };
  }
}

/**
 * Registrerer JWT-plugin og en global onRequest-hook som setter
 * request.bedriftId / request.rolle (og request.bruker når innlogget).
 * Med krevAuth=false (tester) brukes standardbedriften og rolle "admin".
 */
export async function registrerAuth(app: FastifyInstance, krevAuth: boolean) {
  app.decorateRequest("bedriftId", STANDARD_BEDRIFT_ID);
  app.decorateRequest("rolle", "admin");

  await app.register(fastifyJwt, {
    secret: process.env.JWT_HEMMELIGHET ?? "utrygg-lokal-nokkel",
  });

  if (!krevAuth) return;

  app.addHook("onRequest", async (request, reply) => {
    const sti = request.url.split("?")[0];
    if (APNE_STIER.some((re) => re.test(sti))) return;

    let payload: { sub: string };
    try {
      payload = await request.jwtVerify<{ sub: string }>();
    } catch {
      return reply.code(401).send({ error: "Innlogging kreves." });
    }

    const bruker = await prisma.bruker.findUnique({
      where: { id: payload.sub },
      include: { bedrifter: true },
    });
    if (!bruker || !bruker.epost || bruker.bedrifter.length === 0) {
      return reply.code(401).send({ error: "Ugyldig okt - logg inn pa nytt." });
    }

    // Aktiv bedrift: fra x-bedrift-id-header hvis gyldig medlemskap, ellers første.
    const ønsket = request.headers["x-bedrift-id"];
    const medlemskap =
      (typeof ønsket === "string" && bruker.bedrifter.find((m) => m.bedriftId === ønsket)) ||
      bruker.bedrifter[0];

    request.bruker = { id: bruker.id, navn: bruker.navn, epost: bruker.epost };
    request.bedriftId = medlemskap.bedriftId;
    request.rolle = medlemskap.rolle;
  });
}

/** preHandler som krever en bestemt rolle i den aktive bedriften. */
export function krevRolle(rolle: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.rolle !== rolle) {
      return reply.code(403).send({ error: "Krever rollen: " + rolle });
    }
  };
}

/**
 * Oppretter forste admin-bruker fra ADMIN_EPOST/ADMIN_PASSORD hvis den ikke
 * finnes, og gjør den til admin i standardbedriften. Kalt ved oppstart.
 */
export async function sikreAdmin() {
  const epost = process.env.ADMIN_EPOST?.trim().toLowerCase();
  const passord = process.env.ADMIN_PASSORD;
  if (!epost || !passord) {
    console.warn("[auth] ADMIN_EPOST/ADMIN_PASSORD ikke satt - ingen admin opprettet.");
    return;
  }

  let bruker = await prisma.bruker.findUnique({ where: { epost } });
  if (!bruker) {
    const passordHash = await hashPassord(passord);
    bruker = await prisma.bruker.create({ data: { navn: "Administrator", epost, passordHash } });
  }

  await prisma.brukerBedrift.upsert({
    where: { brukerId_bedriftId: { brukerId: bruker.id, bedriftId: STANDARD_BEDRIFT_ID } },
    update: { rolle: "admin" },
    create: { brukerId: bruker.id, bedriftId: STANDARD_BEDRIFT_ID, rolle: "admin" },
  });
  await prisma.invitertEpost.upsert({
    where: { bedriftId_epost: { bedriftId: STANDARD_BEDRIFT_ID, epost } },
    update: { brukt: true },
    create: { bedriftId: STANDARD_BEDRIFT_ID, epost, rolle: "admin", brukt: true },
  });
  console.log(`[auth] admin-bruker sikret: ${epost}`);
}
