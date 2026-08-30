import type { FastifyInstance } from "fastify";
import { sporsmalSchema } from "../schemas/index.js";
import { besvarSporsmal } from "../ai/nlpRapportering.js";

export function sporsmalRoutes(app: FastifyInstance) {
  app.post(
    "/api/rapporter/sporsmal",
    { schema: { tags: ["AI"], summary: "NLP-rapportering: still et spørsmål på naturlig språk" } },
    async (request, reply) => {
      const parsed = sporsmalSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      if (!process.env.ANTHROPIC_API_KEY) {
        return reply
          .status(503)
          .send({ error: "NLP-rapportering er ikke konfigurert (mangler ANTHROPIC_API_KEY)" });
      }

      try {
        return await besvarSporsmal(parsed.data.sporsmal);
      } catch (err) {
        request.log.error(err);
        return reply.status(502).send({ error: "Kunne ikke hente svar fra AI-tjenesten" });
      }
    },
  );
}
