import type { FastifyInstance } from "fastify";
import { put } from "@vercel/blob";
import { bildeOpplastingSchema } from "../schemas/index.js";

const UTVIDELSE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function bilderRoutes(app: FastifyInstance) {
  app.post(
    "/api/bilder",
    { schema: { tags: ["Bilder"], summary: "Last opp et komprimert bilde, far tilbake en offentlig URL" } },
    async (request, reply) => {
      const parsed = bildeOpplastingSchema.safeParse(request.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return reply
          .code(503)
          .send({ error: "Bildelagring er ikke konfigurert (mangler BLOB_READ_WRITE_TOKEN)." });
      }

      const data = Buffer.from(parsed.data.fil, "base64");
      // Klienten komprimerer til ~250-400 KB for opplasting. Avvis apenbart
      // ukomprimerte bilder for a verne lagringskvoten.
      if (data.byteLength > 3 * 1024 * 1024) {
        return reply
          .code(413)
          .send({ error: "Bildet er for stort - komprimer for opplasting (maks 3 MB)." });
      }

      const ext = UTVIDELSE[parsed.data.mediaType] ?? "bin";
      const navn = `varer/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const blob = await put(navn, data, {
        access: "public",
        contentType: parsed.data.mediaType,
      });
      return reply.code(201).send({ url: blob.url });
    },
  );
}
