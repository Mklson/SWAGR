import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { bedriftUpdateSchema } from "../schemas/index.js";
import { krevRolle } from "../auth/index.js";

export function bedriftRoutes(app: FastifyInstance) {
  app.get(
    "/api/bedrift",
    { schema: { tags: ["Bedrift"], summary: "Den aktive bedriften" } },
    async (request) => prisma.bedrift.findUniqueOrThrow({ where: { id: request.bedriftId } }),
  );

  app.patch(
    "/api/bedrift",
    { preHandler: krevRolle("admin"), schema: { tags: ["Bedrift"], summary: "Oppdater navn/logo på den aktive bedriften (admin)" } },
    async (request, reply) => {
      const parsed = bedriftUpdateSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
      return prisma.bedrift.update({ where: { id: request.bedriftId }, data: parsed.data });
    },
  );
}
