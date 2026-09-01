import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { merkeCreateSchema, merkeUpdateSchema } from "../schemas/index.js";
import { registerSimpleCrudRoutes } from "./simpleCrud.js";

export function merkerRoutes(app: FastifyInstance) {
  registerSimpleCrudRoutes(
    app,
    "/api/merker",
    prisma.merke,
    merkeCreateSchema,
    "Merker",
    merkeUpdateSchema,
    async (id) => (await prisma.variant.count({ where: { merkeId: id } })) > 0,
  );
}
