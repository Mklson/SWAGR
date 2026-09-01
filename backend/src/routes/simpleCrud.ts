import type { FastifyInstance } from "fastify";
import type { ZodTypeAny } from "zod";
import { idParamsSchema } from "../schemas/index.js";

interface Delegate {
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
  findMany(args?: { where?: Record<string, unknown> }): Promise<unknown[]>;
  findFirst(args: { where: Record<string, unknown> }): Promise<unknown | null>;
  update(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<unknown>;
  deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
}

/**
 * Registrerer POST (create) og GET (list) for en referansetabell, og - hvis
 * updateSchema er gitt - PATCH /:id og DELETE /:id. Alt tenant-scopet:
 * create setter bedrift_id fra request, list/oppdater/slett filtrerer på den.
 */
export function registerSimpleCrudRoutes(
  app: FastifyInstance,
  path: string,
  delegate: Delegate,
  schema: ZodTypeAny,
  tag: string,
  updateSchema?: ZodTypeAny,
  // Returnerer true hvis raden er i bruk og ikke bør kunne slettes. Uten den
  // ville Prisma stille sette referanser til null (SetNull) - tap av historikk.
  bruktSjekk?: (id: string, bedriftId: string) => Promise<boolean>,
) {
  app.post(
    path,
    { schema: { tags: [tag], summary: `Opprett ${tag.toLowerCase()}` } },
    async (request, reply) => {
      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      const created = await delegate.create({
        data: { ...parsed.data, bedriftId: request.bedriftId },
      });
      return reply.status(201).send(created);
    },
  );

  app.get(
    path,
    { schema: { tags: [tag], summary: `List ${tag.toLowerCase()}` } },
    async (request) => {
      return delegate.findMany({ where: { bedriftId: request.bedriftId } });
    },
  );

  if (!updateSchema) return;

  app.patch(
    `${path}/:id`,
    { schema: { tags: [tag], summary: `Oppdater ${tag.toLowerCase()}` } },
    async (request, reply) => {
      const params = idParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(400).send({ error: params.error.flatten() });
      const body = updateSchema.safeParse(request.body);
      if (!body.success) return reply.status(400).send({ error: body.error.flatten() });
      const finnes = await delegate.findFirst({
        where: { id: params.data.id, bedriftId: request.bedriftId },
      });
      if (!finnes) return reply.status(404).send({ error: `Fant ikke ${tag.toLowerCase()}` });
      return delegate.update({ where: { id: params.data.id }, data: body.data });
    },
  );

  app.delete(
    `${path}/:id`,
    { schema: { tags: [tag], summary: `Slett ${tag.toLowerCase()}` } },
    async (request, reply) => {
      const params = idParamsSchema.safeParse(request.params);
      if (!params.success) return reply.status(400).send({ error: params.error.flatten() });
      const finnes = await delegate.findFirst({
        where: { id: params.data.id, bedriftId: request.bedriftId },
      });
      if (!finnes) return reply.status(404).send({ error: `Fant ikke ${tag.toLowerCase()}` });
      if (bruktSjekk && (await bruktSjekk(params.data.id, request.bedriftId))) {
        return reply.status(409).send({ error: "Elementet er i bruk og kan ikke slettes." });
      }
      try {
        const { count } = await delegate.deleteMany({
          where: { id: params.data.id, bedriftId: request.bedriftId },
        });
        if (count === 0) return reply.status(404).send({ error: `Fant ikke ${tag.toLowerCase()}` });
        return reply.status(204).send();
      } catch (err) {
        // Fremmednøkkel: elementet er i bruk (f.eks. en kunde med bevegelser).
        if ((err as { code?: string }).code === "P2003") {
          return reply
            .status(409)
            .send({ error: "Elementet er i bruk og kan ikke slettes." });
        }
        throw err;
      }
    },
  );
}
