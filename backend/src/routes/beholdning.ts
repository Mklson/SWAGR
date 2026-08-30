import type { FastifyInstance } from "fastify";
import { beholdningQuerySchema } from "../schemas/index.js";
import { beregnBeholdning } from "../lib/rapportBeregning.js";

export function beholdningRoutes(app: FastifyInstance) {
  app.get(
    "/api/beholdning",
    { schema: { tags: ["Beholdning"], summary: "Beregnet beholdning per variant+lokasjon" } },
    async (request, reply) => {
      const parsed = beholdningQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      return beregnBeholdning(parsed.data);
    },
  );
}
