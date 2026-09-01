import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { leverandorCreateSchema, leverandorUpdateSchema } from "../schemas/index.js";
import { registerSimpleCrudRoutes } from "./simpleCrud.js";

export function leverandorerRoutes(app: FastifyInstance) {
  registerSimpleCrudRoutes(
    app,
    "/api/leverandorer",
    prisma.leverandor,
    leverandorCreateSchema,
    "Leverandører",
    leverandorUpdateSchema,
    async (id) => (await prisma.vare.count({ where: { leverandorId: id } })) > 0,
  );
}
