import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { kontekstCreateSchema } from "../schemas/index.js";
import { registerSimpleCrudRoutes } from "./simpleCrud.js";

export function kontekstRoutes(app: FastifyInstance) {
  registerSimpleCrudRoutes(
    app,
    "/api/kontekster",
    prisma.kontekst,
    kontekstCreateSchema,
    "Kontekster",
  );
}
