import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { invitertCreateSchema, invitertIdParamsSchema } from "../schemas/index.js";
import { krevRolle } from "../auth/index.js";

// Admin-styrt tillatsliste for hvem som kan registrere seg i den aktive bedriften.
export function inviterteRoutes(app: FastifyInstance) {
  app.get(
    "/api/inviterte",
    { preHandler: krevRolle("admin"), schema: { tags: ["Auth"], summary: "List inviterte e-poster (admin)" } },
    async (request) =>
      prisma.invitertEpost.findMany({
        where: { bedriftId: request.bedriftId },
        orderBy: { opprettet: "desc" },
      }),
  );

  app.post(
    "/api/inviterte",
    { preHandler: krevRolle("admin"), schema: { tags: ["Auth"], summary: "Inviter en e-post (admin)" } },
    async (request, reply) => {
      const parsed = invitertCreateSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const epost = parsed.data.epost.trim().toLowerCase();

      const invitert = await prisma.invitertEpost.upsert({
        where: { bedriftId_epost: { bedriftId: request.bedriftId, epost } },
        update: parsed.data.rolle ? { rolle: parsed.data.rolle } : {},
        create: { bedriftId: request.bedriftId, epost, rolle: parsed.data.rolle ?? "ansatt" },
      });
      return reply.code(201).send(invitert);
    },
  );

  app.delete(
    "/api/inviterte/:id",
    { preHandler: krevRolle("admin"), schema: { tags: ["Auth"], summary: "Fjern en invitasjon (admin)" } },
    async (request, reply) => {
      const parsed = invitertIdParamsSchema.safeParse(request.params);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      const { count } = await prisma.invitertEpost.deleteMany({
        where: { id: parsed.data.id, bedriftId: request.bedriftId },
      });
      if (count === 0) return reply.code(404).send({ error: "Ikke funnet." });
      return reply.code(204).send();
    },
  );
}
