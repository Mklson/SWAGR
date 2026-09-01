import type { FastifyInstance } from "fastify";
import type { ZodTypeAny } from "zod";

interface Delegate {
  create(args: { data: Record<string, unknown> }): Promise<unknown>;
  findMany(args?: { where?: Record<string, unknown> }): Promise<unknown[]>;
}

/**
 * Registrerer POST (create) og GET (list) for en referansetabell.
 * Tenant-scopet: create setter bedrift_id fra request, list filtrerer på den.
 */
export function registerSimpleCrudRoutes(
  app: FastifyInstance,
  path: string,
  delegate: Delegate,
  schema: ZodTypeAny,
  tag: string,
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
}
