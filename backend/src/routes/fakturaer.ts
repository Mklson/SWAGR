import type { FastifyInstance } from "fastify";
import { fakturaTolkSchema } from "../schemas/index.js";
import { foreslaBevegelser } from "../ai/fakturaparsing.js";

export function fakturaerRoutes(app: FastifyInstance) {
  app.post(
    "/api/fakturaer/tolk",
    { schema: { tags: ["AI"], summary: "Fakturaparsing: tolk en følgeseddel/faktura" } },
    async (request, reply) => {
      const parsed = fakturaTolkSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      if (!process.env.ANTHROPIC_API_KEY) {
        return reply
          .status(503)
          .send({ error: "Fakturaparsing er ikke konfigurert (mangler ANTHROPIC_API_KEY)" });
      }

      try {
        const { fil, mediaType, lokasjonId } = parsed.data;
        return await foreslaBevegelser(fil, mediaType, lokasjonId);
      } catch (err) {
        request.log.error(err);
        return reply.status(502).send({ error: "Kunne ikke tolke dokumentet" });
      }
    },
  );
}
