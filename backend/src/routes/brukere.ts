import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { brukerCreateSchema, brukerUpdateSchema, idParamsSchema } from "../schemas/index.js";

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

  // Rediger navn (på brukeren) og/eller rolle (på medlemskapet i denne bedriften).
  app.patch(
    "/api/brukere/:id",
    { schema: { tags: ["Brukere"], summary: "Oppdater navn/rolle på en bruker i den aktive bedriften" } },
    async (request, reply) => {
      const params = idParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(400).send({ error: params.error.flatten() });
      const body = brukerUpdateSchema.safeParse(request.body);
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() });

      const medlem = await prisma.brukerBedrift.findUnique({
        where: { brukerId_bedriftId: { brukerId: params.data.id, bedriftId: request.bedriftId } },
      });
      if (!medlem) return reply.status(404).send({ error: "Fant ikke brukeren i denne bedriften" });

      if (body.data.navn !== undefined) {
        await prisma.bruker.update({ where: { id: params.data.id }, data: { navn: body.data.navn } });
      }
      if (body.data.rolle !== undefined) {
        await prisma.brukerBedrift.update({
          where: { brukerId_bedriftId: { brukerId: params.data.id, bedriftId: request.bedriftId } },
          data: { rolle: body.data.rolle },
        });
      }
      const oppdatert = await prisma.bruker.findUniqueOrThrow({ where: { id: params.data.id } });
      const rolle = body.data.rolle ?? medlem.rolle;
      return { id: oppdatert.id, navn: oppdatert.navn, rolle, epost: oppdatert.epost };
    },
  );

  // Fjern brukeren fra denne bedriften (sletter medlemskapet, ikke brukeren selv).
  app.delete(
    "/api/brukere/:id",
    { schema: { tags: ["Brukere"], summary: "Fjern en bruker fra den aktive bedriften" } },
    async (request, reply) => {
      const params = idParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(400).send({ error: params.error.flatten() });
      const { count } = await prisma.brukerBedrift.deleteMany({
        where: { brukerId: params.data.id, bedriftId: request.bedriftId },
      });
      if (count === 0) return reply.status(404).send({ error: "Fant ikke brukeren i denne bedriften" });
      return reply.status(204).send();
    },
  );
}
