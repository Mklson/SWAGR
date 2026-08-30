import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { brukerCreateSchema } from "../schemas/index.js";
import { registerSimpleCrudRoutes } from "./simpleCrud.js";

export function brukereRoutes(app: FastifyInstance) {
  registerSimpleCrudRoutes(
    app,
    "/api/brukere",
    prisma.bruker,
    brukerCreateSchema,
    "Brukere",
  );
}
