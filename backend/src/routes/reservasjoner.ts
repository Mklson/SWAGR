import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import {
  reservasjonCreateSchema,
  reservasjonIdParamsSchema,
  reservasjonListQuerySchema,
} from "../schemas/index.js";
import { beregnTilgjengelighet } from "../lib/rapportBeregning.js";

export function reservasjonerRoutes(app: FastifyInstance) {
  app.post(
    "/api/reservasjoner",
    { schema: { tags: ["Reservasjoner"], summary: "Reserver (blokker) antall av en variant på en lokasjon" } },
    async (request, reply) => {
      const parsed = reservasjonCreateSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      const { variantId, lokasjonId, antall } = parsed.data;

      const { tilgjengelig } = await beregnTilgjengelighet(variantId, lokasjonId);
      if (antall > tilgjengelig) {
        return reply.status(409).send({
          error: `Ikke nok tilgjengelig beholdning: ${tilgjengelig} stk tilgjengelig, ${antall} stk forespurt.`,
        });
      }

      const created = await prisma.reservasjon.create({
        data: { ...parsed.data, bedriftId: request.bedriftId },
      });
      return reply.status(201).send(created);
    },
  );

  app.get(
    "/api/reservasjoner",
    { schema: { tags: ["Reservasjoner"], summary: "List reservasjoner" } },
    async (request, reply) => {
      const parsed = reservasjonListQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      const { variantId, lokasjonId, status } = parsed.data;
      return prisma.reservasjon.findMany({
        where: {
          bedriftId: request.bedriftId,
          ...(variantId ? { variantId } : {}),
          ...(lokasjonId ? { lokasjonId } : {}),
          ...(status ? { status } : {}),
        },
        orderBy: { opprettet: "desc" },
      });
    },
  );

  app.post(
    "/api/reservasjoner/:id/kanseller",
    { schema: { tags: ["Reservasjoner"], summary: "Kanseller en reservasjon (frigir blokkert beholdning)" } },
    async (request, reply) => {
      const parsed = reservasjonIdParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      const finnes = await prisma.reservasjon.findFirst({
        where: { id: parsed.data.id, bedriftId: request.bedriftId },
      });
      if (!finnes) return reply.status(404).send({ error: "Fant ikke reservasjonen" });
      return prisma.reservasjon.update({
        where: { id: parsed.data.id },
        data: { status: "kansellert" },
      });
    },
  );

  app.post(
    "/api/reservasjoner/:id/fullfor",
    { schema: { tags: ["Reservasjoner"], summary: "Merk en reservasjon som fullført (frigir blokkert beholdning)" } },
    async (request, reply) => {
      const parsed = reservasjonIdParamsSchema.safeParse(request.params);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      const finnes = await prisma.reservasjon.findFirst({
        where: { id: parsed.data.id, bedriftId: request.bedriftId },
      });
      if (!finnes) return reply.status(404).send({ error: "Fant ikke reservasjonen" });
      return prisma.reservasjon.update({
        where: { id: parsed.data.id },
        data: { status: "fullfort" },
      });
    },
  );
}
