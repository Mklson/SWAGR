import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { loggInnSchema, registrerSchema } from "../schemas/index.js";
import { hashPassord, verifiserPassord } from "../auth/passord.js";

function offentligBruker(b: { id: string; navn: string; rolle: string; epost: string | null }) {
  return { id: b.id, navn: b.navn, rolle: b.rolle, epost: b.epost };
}

export function authRoutes(app: FastifyInstance) {
  app.post(
    "/api/auth/registrer",
    { schema: { tags: ["Auth"], summary: "Registrer ny bruker (krever invitasjon)" } },
    async (request, reply) => {
      const parsed = registrerSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const epost = parsed.data.epost.trim().toLowerCase();

      const invitasjon = await prisma.invitertEpost.findUnique({ where: { epost } });
      if (!invitasjon || invitasjon.brukt) {
        return reply
          .code(403)
          .send({ error: "E-posten er ikke invitert. Kontakt en administrator." });
      }

      const eksisterende = await prisma.bruker.findUnique({ where: { epost } });
      if (eksisterende) {
        return reply.code(409).send({ error: "Det finnes allerede en bruker med denne e-posten." });
      }

      const passordHash = await hashPassord(parsed.data.passord);
      const bruker = await prisma.bruker.create({
        data: { navn: parsed.data.navn.trim(), rolle: invitasjon.rolle, epost, passordHash },
      });
      await prisma.invitertEpost.update({ where: { epost }, data: { brukt: true } });

      const token = app.jwt.sign({ sub: bruker.id, rolle: bruker.rolle }, { expiresIn: "30d" });
      return reply.code(201).send({ token, bruker: offentligBruker(bruker) });
    },
  );

  app.post(
    "/api/auth/logg-inn",
    { schema: { tags: ["Auth"], summary: "Logg inn med e-post og passord" } },
    async (request, reply) => {
      const parsed = loggInnSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const epost = parsed.data.epost.trim().toLowerCase();

      const bruker = await prisma.bruker.findUnique({ where: { epost } });
      const gyldig =
        bruker?.passordHash != null &&
        (await verifiserPassord(bruker.passordHash, parsed.data.passord));
      if (!bruker || !gyldig) {
        return reply.code(401).send({ error: "Feil e-post eller passord." });
      }

      const token = app.jwt.sign({ sub: bruker.id, rolle: bruker.rolle }, { expiresIn: "30d" });
      return reply.send({ token, bruker: offentligBruker(bruker) });
    },
  );

  app.get(
    "/api/auth/meg",
    { schema: { tags: ["Auth"], summary: "Info om innlogget bruker" } },
    async (request, reply) => {
      if (!request.bruker) return reply.code(401).send({ error: "Ikke innlogget." });
      return request.bruker;
    },
  );
}
