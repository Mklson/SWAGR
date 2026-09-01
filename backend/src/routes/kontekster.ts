import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { kontekstCreateSchema, kontekstUpdateSchema } from "../schemas/index.js";
import { registerSimpleCrudRoutes } from "./simpleCrud.js";

export function kontekstRoutes(app: FastifyInstance) {
  registerSimpleCrudRoutes(
    app,
    "/api/kontekster",
    prisma.kontekst,
    kontekstCreateSchema,
    "Kontekster",
    kontekstUpdateSchema,
    async (id) =>
      (await prisma.bevegelse.count({ where: { kontekstId: id } })) > 0 ||
      (await prisma.reservasjon.count({ where: { kontekstId: id } })) > 0,
  );
}
