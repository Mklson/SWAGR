import type { FastifyInstance } from "fastify";
import { variantGjenkjennSchema } from "../schemas/index.js";
import { gjenkjennVariant } from "../ai/bildegjenkjenning.js";

export function variantGjenkjenningRoutes(app: FastifyInstance) {
  app.post(
    "/api/varianter/gjenkjenn",
    { schema: { tags: ["AI"], summary: "Bildegjenkjenning: foreslå variantId fra et bilde" } },
    async (request, reply) => {
      const parsed = variantGjenkjennSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      if (!process.env.ANTHROPIC_API_KEY) {
        return reply
          .status(503)
          .send({ error: "Bildegjenkjenning er ikke konfigurert (mangler ANTHROPIC_API_KEY)" });
      }

      try {
        const { fil, mediaType } = parsed.data;
        return await gjenkjennVariant(fil, mediaType);
      } catch (err) {
        request.log.error(err);
        return reply.status(502).send({ error: "Kunne ikke tolke bildet" });
      }
    },
  );
}
