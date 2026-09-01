import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { sokVariant } from "../lib/sok.js";

const client = new Anthropic();

const BildeBeskrivelseSchema = z.object({
  varetype: z.string().describe("Hva slags produkt dette er, f.eks. 'T-skjorte', 'Vinglass'"),
  beskrivelse: z
    .string()
    .describe("Kort beskrivelse av varianten: farge, trykk/logo, størrelse, materiale osv."),
  synligSku: z
    .string()
    .nullable()
    .describe("SKU/artikkelnummer hvis synlig på etikett/tag i bildet, ellers null"),
});

export type BildeMediaType = "image/png" | "image/jpeg" | "image/webp";

async function beskrivBilde(fil: string, mediaType: BildeMediaType) {
  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: fil } },
          {
            type: "text",
            text: "Beskriv varen på dette bildet: varetype, farge/trykk/størrelse/materiale, og eventuell synlig SKU/artikkelnummer på etikett.",
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(BildeBeskrivelseSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Klarte ikke å tolke bildet til strukturert data");
  }
  return response.parsed_output;
}

export interface VariantKandidat {
  id: string;
  navn: string;
  sku: string;
  attributter: unknown;
}

export interface VariantGjenkjenningResultat {
  varetype: string;
  beskrivelse: string;
  synligSku: string | null;
  variantId: string | null;
  kandidater: VariantKandidat[];
  nyVariant: boolean;
}

export async function gjenkjennVariant(
  bedriftId: string,
  fil: string,
  mediaType: BildeMediaType,
): Promise<VariantGjenkjenningResultat> {
  const beskrevet = await beskrivBilde(fil, mediaType);

  const treff = new Map<string, Awaited<ReturnType<typeof sokVariant>>[number]>();
  for (const sok of [beskrevet.synligSku, beskrevet.varetype].filter((s): s is string => !!s)) {
    for (const v of await sokVariant(bedriftId, sok)) {
      treff.set(v.id, v);
    }
  }
  const kandidater = Array.from(treff.values());

  return {
    varetype: beskrevet.varetype,
    beskrivelse: beskrevet.beskrivelse,
    synligSku: beskrevet.synligSku,
    variantId: kandidater.length === 1 ? kandidater[0].id : null,
    kandidater: kandidater.map((v) => ({
      id: v.id,
      navn: v.vare.navn,
      sku: v.sku,
      attributter: v.attributter,
    })),
    nyVariant: kandidater.length === 0,
  };
}
