import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { variantCreateSchema, variantIdParamsSchema, variantUpdateSchema } from "../schemas/index.js";
import { registerSimpleCrudRoutes } from "./simpleCrud.js";

export function variantRoutes(app: FastifyInstance) {
  registerSimpleCrudRoutes(
    app,
    "/api/varianter",
    prisma.variant,
    variantCreateSchema,
    "Varianter",
  );

  // Priser og merke endrer seg over tid - egen oppdateringsrute i tillegg til
  // opprett, siden simpleCrud kun dekker opprett+list.
  app.patch(
    "/api/varianter/:id",
    { schema: { tags: ["Varianter"], summary: "Oppdater bilde, merke eller verdi på en variant" } },
    async (request, reply) => {
      const paramsParsed = variantIdParamsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: paramsParsed.error.flatten() });
      }
      const bodyParsed = variantUpdateSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: bodyParsed.error.flatten() });
      }
      const finnes = await prisma.variant.findFirst({
        where: { id: paramsParsed.data.id, bedriftId: request.bedriftId },
      });
      if (!finnes) return reply.status(404).send({ error: "Fant ikke varianten" });
      return prisma.variant.update({ where: { id: paramsParsed.data.id }, data: bodyParsed.data });
    },
  );

  // Slett en enkelt variant. Blokkeres hvis den har bevegelser/reservasjoner.
  app.delete(
    "/api/varianter/:id",
    { schema: { tags: ["Varianter"], summary: "Slett en variant" } },
    async (request, reply) => {
      const paramsParsed = variantIdParamsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: paramsParsed.error.flatten() });
      }
      const variant = await prisma.variant.findFirst({
        where: { id: paramsParsed.data.id, bedriftId: request.bedriftId },
      });
      if (!variant) return reply.status(404).send({ error: "Fant ikke varianten" });

      const iBruk =
        (await prisma.bevegelse.count({ where: { variantId: variant.id } })) > 0 ||
        (await prisma.reservasjon.count({ where: { variantId: variant.id } })) > 0;
      if (iBruk) {
        return reply
          .status(409)
          .send({ error: "Varianten har registrerte bevegelser og kan ikke slettes." });
      }

      await prisma.variant.delete({ where: { id: variant.id } });
      return reply.status(204).send();
    },
  );
}
