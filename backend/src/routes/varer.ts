import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { vareCreateSchema, vareIdParamsSchema, vareUpdateSchema } from "../schemas/index.js";
import { registerSimpleCrudRoutes } from "./simpleCrud.js";

export function varerRoutes(app: FastifyInstance) {
  registerSimpleCrudRoutes(app, "/api/varer", prisma.vare, vareCreateSchema, "Varer");

  // Navn/kategori/leverandør kan endres i ettertid (redigering av en artikkel).
  app.patch(
    "/api/varer/:id",
    { schema: { tags: ["Varer"], summary: "Oppdater navn, kategori eller leverandør på en vare" } },
    async (request, reply) => {
      const paramsParsed = vareIdParamsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: paramsParsed.error.flatten() });
      }
      const bodyParsed = vareUpdateSchema.safeParse(request.body);
      if (!bodyParsed.success) {
        return reply.status(400).send({ error: bodyParsed.error.flatten() });
      }
      const finnes = await prisma.vare.findFirst({
        where: { id: paramsParsed.data.id, bedriftId: request.bedriftId },
      });
      if (!finnes) return reply.status(404).send({ error: "Fant ikke varen" });
      return prisma.vare.update({ where: { id: paramsParsed.data.id }, data: bodyParsed.data });
    },
  );

  // Slett en hel artikkel (vare + alle varianter under den). Blokkeres hvis
  // noen variant har registrerte bevegelser/reservasjoner - da ville historikk
  // gå tapt eller stille bli koblet fra.
  app.delete(
    "/api/varer/:id",
    { schema: { tags: ["Varer"], summary: "Slett en artikkel og alle variantene under den" } },
    async (request, reply) => {
      const paramsParsed = vareIdParamsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: paramsParsed.error.flatten() });
      }
      const vare = await prisma.vare.findFirst({
        where: { id: paramsParsed.data.id, bedriftId: request.bedriftId },
        include: { varianter: { select: { id: true } } },
      });
      if (!vare) return reply.status(404).send({ error: "Fant ikke varen" });

      const variantIds = vare.varianter.map((v) => v.id);
      const iBruk =
        (await prisma.bevegelse.count({ where: { variantId: { in: variantIds } } })) > 0 ||
        (await prisma.reservasjon.count({ where: { variantId: { in: variantIds } } })) > 0;
      if (iBruk) {
        return reply
          .status(409)
          .send({ error: "Artikkelen har registrerte bevegelser og kan ikke slettes." });
      }

      await prisma.$transaction([
        prisma.variant.deleteMany({ where: { vareId: vare.id } }),
        prisma.vare.delete({ where: { id: vare.id } }),
      ]);
      return reply.status(204).send();
    },
  );
}
