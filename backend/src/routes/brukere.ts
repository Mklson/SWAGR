import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { brukerCreateSchema } from "../schemas/index.js";

// Brukere er medlemmer av den aktive bedriften (via BrukerBedrift). Rollen
// ligger på medlemskapet, ikke på brukeren.
export function brukereRoutes(app: FastifyInstance) {
  app.get(
    "/api/brukere",
    { schema: { tags: ["Brukere"], summary: "List brukere i den aktive bedriften" } },
    async (request) => {
      const medlemskap = await prisma.brukerBedrift.findMany({
        where: { bedriftId: request.bedriftId },
        include: { bruker: true },
        orderBy: { opprettet: "asc" },
      });
      return medlemskap.map((m) => ({
        id: m.bruker.id,
        navn: m.bruker.navn,
        rolle: m.rolle,
        epost: m.bruker.epost,
      }));
    },
  );

  app.post(
    "/api/brukere",
    { schema: { tags: ["Brukere"], summary: "Opprett en bruker i den aktive bedriften" } },
    async (request, reply) => {
      const parsed = brukerCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      const bruker = await prisma.bruker.create({
        data: {
          navn: parsed.data.navn,
          bedrifter: { create: { bedriftId: request.bedriftId, rolle: parsed.data.rolle } },
        },
      });
      return reply
        .status(201)
        .send({ id: bruker.id, navn: bruker.navn, rolle: parsed.data.rolle, epost: bruker.epost });
    },
  );
}
