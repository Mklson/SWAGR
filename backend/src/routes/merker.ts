import type { FastifyInstance } from "fastify";
import { prisma } from "../db/client.js";
import { merkeCreateSchema } from "../schemas/index.js";
import { registerSimpleCrudRoutes } from "./simpleCrud.js";

export function merkerRoutes(app: FastifyInstance) {
  registerSimpleCrudRoutes(app, "/api/merker", prisma.merke, merkeCreateSchema, "Merker");
}
