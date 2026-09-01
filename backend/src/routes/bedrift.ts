import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { bedriftUpdateSchema } from "../schemas/index.js";

export function bedriftRoutes(app: FastifyInstance) {
  app.get(
    "/api/bedrift",
    { schema: { tags: ["Bedrift"], summary: "Den aktive bedriften" } },
    async (request) => prisma.bedrift.findUniqueOrThrow({ where: { id: request.bedriftId } }),
  );

  // Alle innloggede medlemmer av bedriften kan endre navn/logo.
  app.patch(
    "/api/bedrift",
    { schema: { tags: ["Bedrift"], summary: "Oppdater navn/logo på den aktive bedriften" } },
    async (request, reply) => {
      const parsed = bedriftUpdateSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      return prisma.bedrift.update({ where: { id: request.bedriftId }, data: parsed.data });
    },
  );
}
