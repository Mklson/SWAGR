import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyJwt from "@fastify/jwt";
import { prisma } from "../db/client.js";
import { hashPassord } from "./passord.js";

// Stier som er tilgjengelige uten innlogging: helsesjekk, API-dok og selve
// innloggings-/registreringsendepunktene.
const APNE_STIER = [/^\/health$/, /^\/docs(\/|$)/, /^\/api\/auth\/(logg-inn|registrer)$/];

export interface AuthBruker {
  id: string;
  navn: string;
  rolle: string;
  epost: string;
}

declare module "fastify" {
  interface FastifyRequest {
    bruker?: AuthBruker;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: { sub: string; rolle: string };
    user: { sub: string; rolle: string };
  }
}

/**
 * Registrerer JWT-plugin og - nar krevAuth er sann - en global onRequest-hook
 * som avviser alle ikke-apne stier uten gyldig token. Slas av i tester.
 */
export async function registrerAuth(app: FastifyInstance, krevAuth: boolean) {
  await app.register(fastifyJwt, {
    secret: process.env.JWT_HEMMELIGHET ?? "utrygg-lokal-nokkel",
  });

  if (!krevAuth) return;

  app.addHook("onRequest", async (request, reply) => {
    const sti = request.url.split("?")[0];
    if (APNE_STIER.some((re) => re.test(sti))) return;

    try {
      const payload = await request.jwtVerify<{ sub: string }>();
      const bruker = await prisma.bruker.findUnique({ where: { id: payload.sub } });
      if (!bruker || !bruker.epost) {
        return reply.code(401).send({ error: "Ugyldig okt - logg inn pa nytt." });
      }
      request.bruker = {
        id: bruker.id,
        navn: bruker.navn,
        rolle: bruker.rolle,
        epost: bruker.epost,
      };
    } catch {
      return reply.code(401).send({ error: "Innlogging kreves." });
    }
  });
}

/** preHandler som krever at innlogget bruker har en bestemt rolle. */
export function krevRolle(rolle: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (request.bruker?.rolle !== rolle) {
      return reply.code(403).send({ error: "Krever rollen: " + rolle });
    }
  };
}

/**
 * Oppretter forste admin-bruker fra ADMIN_EPOST/ADMIN_PASSORD hvis den ikke
 * finnes. Kalt ved oppstart. Hopper over (med advarsel) hvis env mangler.
 */
export async function sikreAdmin() {
  const epost = process.env.ADMIN_EPOST?.trim().toLowerCase();
  const passord = process.env.ADMIN_PASSORD;
  if (!epost || !passord) {
    console.warn("[auth] ADMIN_EPOST/ADMIN_PASSORD ikke satt - ingen admin opprettet.");
    return;
  }

  const finnes = await prisma.bruker.findUnique({ where: { epost } });
  if (finnes) return;

  const passordHash = await hashPassord(passord);
  await prisma.bruker.create({
    data: { navn: "Administrator", rolle: "admin", epost, passordHash },
  });
  await prisma.invitertEpost.upsert({
    where: { epost },
    update: { brukt: true },
    create: { epost, rolle: "admin", brukt: true },
  });
  console.log(`[auth] admin-bruker opprettet: ${epost}`);
}
