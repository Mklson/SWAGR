import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { formaalCreateSchema, formaalUpdateSchema } from "../schemas/index.js";
import { registerSimpleCrudRoutes } from "./simpleCrud.js";

// Enkelt formål for et uttak - "Festival", "Messe", "Gave" osv.
export function formaalRoutes(app: FastifyInstance) {
  registerSimpleCrudRoutes(
    app,
    "/api/formaal",
    prisma.formaal,
    formaalCreateSchema,
    "Formaal",
    formaalUpdateSchema,
    async (id) =>
      (await prisma.bevegelse.count({ where: { formaalId: id } })) > 0 ||
      (await prisma.reservasjon.count({ where: { formaalId: id } })) > 0,
  );
}
