import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { loggInnSchema, registrerSchema } from "../schemas/index.js";
import { hashPassord, verifiserPassord } from "../auth/passord.js";

interface BrukerMedBedrifter {
  id: string;
  navn: string;
  epost: string | null;
  bedrifter: { bedriftId: string; rolle: string; bedrift: { navn: string; logoUrl: string | null } }[];
}

function svarForBruker(app: FastifyInstance, b: BrukerMedBedrifter) {
  return {
    token: app.jwt.sign({ sub: b.id }, { expiresIn: "30d" }),
    bruker: { id: b.id, navn: b.navn, epost: b.epost },
    bedrifter: b.bedrifter.map((m) => ({
      id: m.bedriftId,
      navn: m.bedrift.navn,
      logoUrl: m.bedrift.logoUrl,
      rolle: m.rolle,
    })),
  };
}

const medBedrifter = { bedrifter: { include: { bedrift: true } } } as const;

export function authRoutes(app: FastifyInstance) {
  app.post(
    "/api/auth/registrer",
    { schema: { tags: ["Auth"], summary: "Registrer ny bruker (krever invitasjon)" } },
    async (request, reply) => {
      const parsed = registrerSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const epost = parsed.data.epost.trim().toLowerCase();

      const invitasjon = await prisma.invitertEpost.findFirst({ where: { epost, brukt: false } });
      if (!invitasjon) {
        return reply
          .code(403)
          .send({ error: "E-posten er ikke invitert. Kontakt en administrator." });
      }

      let bruker = await prisma.bruker.findUnique({ where: { epost } });
      if (bruker) {
        // Finnes fra før (invitert til flere bedrifter) - bare koble til.
        await prisma.brukerBedrift.upsert({
          where: { brukerId_bedriftId: { brukerId: bruker.id, bedriftId: invitasjon.bedriftId } },
          update: { rolle: invitasjon.rolle },
          create: { brukerId: bruker.id, bedriftId: invitasjon.bedriftId, rolle: invitasjon.rolle },
        });
      } else {
        const passordHash = await hashPassord(parsed.data.passord);
        bruker = await prisma.bruker.create({
          data: {
            navn: parsed.data.navn.trim(),
            epost,
            passordHash,
            bedrifter: {
              create: { bedriftId: invitasjon.bedriftId, rolle: invitasjon.rolle },
            },
          },
        });
      }
      await prisma.invitertEpost.update({ where: { id: invitasjon.id }, data: { brukt: true } });

      const full = await prisma.bruker.findUniqueOrThrow({
        where: { id: bruker.id },
        include: medBedrifter,
      });
      return reply.code(201).send(svarForBruker(app, full));
    },
  );

  app.post(
    "/api/auth/logg-inn",
    { schema: { tags: ["Auth"], summary: "Logg inn med e-post og passord" } },
    async (request, reply) => {
      const parsed = loggInnSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const epost = parsed.data.epost.trim().toLowerCase();

      const bruker = await prisma.bruker.findUnique({
        where: { epost },
        include: medBedrifter,
      });
      const gyldig =
        bruker?.passordHash != null &&
        (await verifiserPassord(bruker.passordHash, parsed.data.passord));
      if (!bruker || !gyldig) {
        return reply.code(401).send({ error: "Feil e-post eller passord." });
      }
      return reply.send(svarForBruker(app, bruker));
    },
  );

  app.get(
    "/api/auth/meg",
    { schema: { tags: ["Auth"], summary: "Info om innlogget bruker og bedrifter" } },
    async (request, reply) => {
      if (!request.bruker) return reply.code(401).send({ error: "Ikke innlogget." });
      const bruker = await prisma.bruker.findUnique({
        where: { id: request.bruker.id },
        include: medBedrifter,
      });
      if (!bruker) return reply.code(401).send({ error: "Ikke innlogget." });
      return {
        bruker: { id: bruker.id, navn: bruker.navn, epost: bruker.epost },
        bedrifter: bruker.bedrifter.map((m) => ({
          id: m.bedriftId,
          navn: m.bedrift.navn,
          logoUrl: m.bedrift.logoUrl,
          rolle: m.rolle,
        })),
        aktivBedriftId: request.bedriftId,
      };
    },
  );
}
