import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { leverandorCreateSchema } from "../schemas/index.js";
import { registerSimpleCrudRoutes } from "./simpleCrud.js";

export function leverandorerRoutes(app: FastifyInstance) {
  registerSimpleCrudRoutes(
    app,
    "/api/leverandorer",
    prisma.leverandor,
    leverandorCreateSchema,
    "Leverandører",
  );
}
