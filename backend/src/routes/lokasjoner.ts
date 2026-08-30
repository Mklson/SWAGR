import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { lokasjonCreateSchema } from "../schemas/index.js";
import { registerSimpleCrudRoutes } from "./simpleCrud.js";

export function lokasjonerRoutes(app: FastifyInstance) {
  registerSimpleCrudRoutes(
    app,
    "/api/lokasjoner",
    prisma.lokasjon,
    lokasjonCreateSchema,
    "Lokasjoner",
  );
}
