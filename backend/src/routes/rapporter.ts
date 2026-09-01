import type { FastifyInstance } from "fastify";
import type { BevegelseType } from "@prisma/client";
import {
  rapportDetaljertQuerySchema,
  rapportFleksibelQuerySchema,
  rapportInngaendeQuerySchema,
  rapportKontekstParamsSchema,
  rapportKontekstQuerySchema,
  rapportPeriodeQuerySchema,
} from "../schemas/index.js";
import {
  beregnRapportDetaljert,
  beregnRapportFleksibel,
  beregnRapportInngaende,
  beregnRapportKontekst,
  beregnRapportPeriode,
} from "../lib/rapportBeregning.js";

const BEVEGELSE_TYPER: BevegelseType[] = ["inn", "ut", "svinn", "retur", "internbruk"];
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function listeParam(verdi: string | undefined, gyldig?: (s: string) => boolean): string[] | undefined {
  if (!verdi) return undefined;
  const deler = verdi
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && (!gyldig || gyldig(s)));
  return deler.length ? deler : undefined;
}

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

  // Inngående varer / varemottak: alt som er tatt inn på lager, summert per
  // variant, filtrerbart på lokasjon, merke, leverandør og periode.
  app.get(
    "/api/rapporter/inngaende",
    { schema: { tags: ["Rapporter"], summary: "Inngående varer (varemottak) summert per variant" } },
    async (request, reply) => {
      const parsed = rapportInngaendeQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      return beregnRapportInngaende({ ...parsed.data, bedriftId: request.bedriftId });
    },
  );

  // Egendefinert rapport: fritt valg av kunder + artikler + typer + lokasjon +
  // periode. Én rad per bevegelse, hvert felt i egen kolonne på klienten.
  app.get(
    "/api/rapporter/detaljert",
    { schema: { tags: ["Rapporter"], summary: "Egendefinert linjenivå-rapport" } },
    async (request, reply) => {
      const parsed = rapportDetaljertQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.flatten() });
      }
      const typer = listeParam(parsed.data.type, (s) =>
        (BEVEGELSE_TYPER as string[]).includes(s),
      ) as BevegelseType[] | undefined;
      return beregnRapportDetaljert({
        bedriftId: request.bedriftId,
        kontekstIds: listeParam(parsed.data.kontekstId, (s) => UUID_RE.test(s)),
        vareIds: listeParam(parsed.data.vareId, (s) => UUID_RE.test(s)),
        typer,
        lokasjonId: parsed.data.lokasjonId,
        fra: parsed.data.fra,
        til: parsed.data.til,
      });
    },
  );
}
