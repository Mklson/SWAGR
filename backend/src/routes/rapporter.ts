import type { FastifyInstance } from "fastify";
import {
  rapportFleksibelQuerySchema,
  rapportKontekstParamsSchema,
  rapportKontekstQuerySchema,
  rapportPeriodeQuerySchema,
} from "../schemas/index.js";
import { beregnRapportFleksibel, beregnRapportKontekst, beregnRapportPeriode } from "../lib/rapportBeregning.js";

export function rapporterRoutes(app: FastifyInstance) {
  // Summerer antall per variant+type for én kontekst (f.eks. "hvor mye har vi
  // levert til kunde X dette året").
  app.get(
    "/api/rapporter/kontekst/:kontekstId",
    { schema: { tags: ["Rapporter"], summary: "Summert antall per variant+type for én kontekst" } },
    async (request, reply) => {
      const paramsParsed = rapportKontekstParamsSchema.safeParse(request.params);
      if (!paramsParsed.success) {
        return reply.status(400).send({ error: paramsParsed.error.flatten() });
      }
      const queryParsed = rapportKontekstQuerySchema.safeParse(request.query);
      if (!queryParsed.success) {
        return reply.status(400).send({ error: queryParsed.error.flatten() });
      }
      return beregnRapportKontekst(paramsParsed.data.kontekstId, { ...queryParsed.data, bedriftId: request.bedriftId });
    },
  );

  // Summerer antall per type innenfor en periode, filtrerbar på variant/lokasjon/kontekst
  // (f.eks. totalt svinn denne måneden).
  app.get(
    "/api/rapporter/periode",
    { schema: { tags: ["Rapporter"], summary: "Summert antall per type innenfor en periode" } },
    async (request, reply) => {
      const parsed = rapportPeriodeQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      return beregnRapportPeriode({ ...parsed.data, bedriftId: request.bedriftId });
    },
  );

  // Kontekst og/eller merke er valgfrie - dekker "verdi for merke X på tvers
  // av alle kunder", "verdi for kunde Y på tvers av alle merker", og alt
  // uten filter, uten å tvinge frem ett bestemt valg slik /kontekst/:id gjør.
  app.get(
    "/api/rapporter/fleksibel",
    { schema: { tags: ["Rapporter"], summary: "Summert antall+verdi per kontekst+merke, begge valgfrie filtre" } },
    async (request, reply) => {
      const parsed = rapportFleksibelQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      return beregnRapportFleksibel({ ...parsed.data, bedriftId: request.bedriftId });
    },
  );
}
