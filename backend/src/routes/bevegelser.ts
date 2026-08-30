import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import {
  bevegelseCreateSchema,
  bevegelseListQuerySchema,
} from "../schemas/index.js";
import { BEVEGELSE_FORTEGN } from "../lib/bevegelseFortegn.js";
import { beregnTilgjengelighet } from "../lib/rapportBeregning.js";

export function bevegelserRoutes(app: FastifyInstance) {
  app.post("/api/bevegelser", { schema: { tags: ["Bevegelser"], summary: "Registrer en bevegelse" } }, async (request, reply) => {
    const parsed = bevegelseCreateSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { variantId, lokasjonId, type, antall } = parsed.data;

    // Reduserende bevegelser (ut/svinn/internbruk) får ikke spise av antall
    // andre har reservert - selv om varen fysisk står på lager. Systemet har
    // aldri hindret beholdning i å gå negativt uten reservasjon (bevisst
    // fleksibelt for feilrettinger/etterregistrering) - denne sjekken skal
    // kun beskytte reservert antall, ikke innføre en generell nulltoleranse.
    if (BEVEGELSE_FORTEGN[type] === -1) {
      const { beholdning, reservert } = await beregnTilgjengelighet(variantId, lokasjonId);
      if (reservert > 0 && beholdning - antall < reservert) {
        return reply.status(409).send({
          error: `Kan ikke registrere: ${reservert} stk er reservert og kan ikke tas ut. ${beholdning} stk fysisk, ${antall} stk forespurt.`,
        });
      }
    }

    // Verdi kopieres fra varianten på registreringstidspunktet, ikke lest via
    // relasjon ved rapportering - en senere prisendring skal ikke endre hva
    // historiske bevegelser sier de var verdt.
    const variant = await prisma.variant.findUnique({
      where: { id: variantId },
      select: { verdiOre: true },
    });
    const created = await prisma.bevegelse.create({
      data: { ...parsed.data, verdiOre: variant?.verdiOre ?? null },
    });
    return reply.status(201).send(created);
  });

  app.get("/api/bevegelser", { schema: { tags: ["Bevegelser"], summary: "List bevegelser" } }, async (request, reply) => {
    const parsed = bevegelseListQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.flatten() });
    }
    const { variantId, lokasjonId, kontekstId } = parsed.data;
    return prisma.bevegelse.findMany({
      where: {
        ...(variantId ? { variantId } : {}),
        ...(lokasjonId ? { lokasjonId } : {}),
        ...(kontekstId ? { kontekstId } : {}),
      },
      orderBy: { tidspunkt: "desc" },
    });
  });
}
