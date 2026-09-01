import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { lokasjonCreateSchema, lokasjonUpdateSchema } from "../schemas/index.js";
import { registerSimpleCrudRoutes } from "./simpleCrud.js";

export function lokasjonerRoutes(app: FastifyInstance) {
  registerSimpleCrudRoutes(
    app,
    "/api/lokasjoner",
    prisma.lokasjon,
    lokasjonCreateSchema,
    "Lokasjoner",
    lokasjonUpdateSchema,
    async (id) =>
      (await prisma.bevegelse.count({ where: { lokasjonId: id } })) > 0 ||
      (await prisma.reservasjon.count({ where: { lokasjonId: id } })) > 0,
  );
}
