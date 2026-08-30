import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { vareCreateSchema } from "../schemas/index.js";
import { registerSimpleCrudRoutes } from "./simpleCrud.js";

export function varerRoutes(app: FastifyInstance) {
  registerSimpleCrudRoutes(app, "/api/varer", prisma.vare, vareCreateSchema, "Varer");
}
