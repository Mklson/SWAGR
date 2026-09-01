import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod/v4";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { BevegelseType } from "@prisma/client";
import { sokKontekst, sokVariant } from "../lib/sok.js";

const client = new Anthropic();

const FakturaLinjeSchema = z.object({
  vareBeskrivelse: z.string().describe("Varebeskrivelse slik den står på dokumentet"),
  antall: z.number().int().positive(),
});

const FakturaEkstraksjonSchema = z.object({
  leverandor: z.string().nullable().describe("Leverandørnavn hvis oppgitt på dokumentet"),
  kunde: z.string().nullable().describe("Kundenavn hvis oppgitt på dokumentet"),
  dato: z.string().nullable().describe("Dato på dokumentet, ISO 8601 hvis mulig, ellers null"),
  retning: z
    .enum(["inn", "ut"])
    .describe("'inn' hvis varer mottas til lager (f.eks. fra leverandør), 'ut' hvis varer sendes ut (f.eks. til kunde)"),
  linjer: z.array(FakturaLinjeSchema),
});

export type FakturaMediaType = "application/pdf" | "image/png" | "image/jpeg" | "image/webp";

async function tolkDokument(fil: string, mediaType: FakturaMediaType) {
  const dokumentBlock: Anthropic.Messages.ContentBlockParam =
    mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: fil } }
      : { type: "image", source: { type: "base64", media_type: mediaType, data: fil } };

  const response = await client.messages.parse({
    model: "claude-opus-5",
    max_tokens: 4096,
    messages: [
      {
        role: "user",
        content: [
          dokumentBlock,
          {
            type: "text",
            text: "Les denne følgeseddelen/fakturaen og trekk ut leverandør, kunde, dato, retning (inn/ut) og varelinjer (beskrivelse + antall) nøyaktig slik de står på dokumentet.",
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(FakturaEkstraksjonSchema) },
  });

  if (!response.parsed_output) {
    throw new Error("Klarte ikke å tolke dokumentet til strukturert data");
  }
  return response.parsed_output;
}

export interface FakturaLinjeForslag {
  raLinje: string;
  antall: number;
  type: BevegelseType;
  lokasjonId: string;
  variantId: string | null;
  variantKandidater: { id: string; navn: string; sku: string }[];
  kontekstId: string | null;
  kontekstKandidater: { id: string; navn: string; type: string }[];
}

export interface FakturaTolkningResultat {
  leverandor: string | null;
  kunde: string | null;
  dato: string | null;
  forslag: FakturaLinjeForslag[];
  merknader: string[];
}

export async function foreslaBevegelser(
  bedriftId: string,
  fil: string,
  mediaType: FakturaMediaType,
  lokasjonId: string,
): Promise<FakturaTolkningResultat> {
  const ekstrahert = await tolkDokument(fil, mediaType);
  const kontekstSoketekst = ekstrahert.retning === "ut" ? ekstrahert.kunde : ekstrahert.leverandor;
  // Innkommende varer bør knyttes til en innkjop/retur-kontekst, ikke en kunde/prosjekt-kontekst
  // som semantisk gjelder utgående bevegelser.
  const tillatteTyper = ekstrahert.retning === "inn" ? ["innkjop", "retur"] : ["kunde", "prosjekt", "internbruk"];
  const kontekstKandidater = kontekstSoketekst
    ? (await sokKontekst(bedriftId, kontekstSoketekst)).filter((k) => tillatteTyper.includes(k.type))
    : [];

  const merknader: string[] = [];
  if (ekstrahert.retning === "inn" && kontekstKandidater.length === 0) {
    merknader.push(
      kontekstSoketekst
        ? `Fant ingen innkjop-kontekst for "${kontekstSoketekst}" — opprett en kontekst av type innkjop for denne leverandøren før du bekrefter disse linjene.`
        : "Fant ikke leverandørnavn på dokumentet — velg kontekst manuelt for disse linjene.",
    );
  }

  const forslag: FakturaLinjeForslag[] = [];
  for (const linje of ekstrahert.linjer) {
    const variantTreff = await sokVariant(bedriftId, linje.vareBeskrivelse);
    forslag.push({
      raLinje: linje.vareBeskrivelse,
      antall: linje.antall,
      type: ekstrahert.retning,
      lokasjonId,
      variantId: variantTreff.length === 1 ? variantTreff[0].id : null,
      variantKandidater: variantTreff.map((v) => ({ id: v.id, navn: v.vare.navn, sku: v.sku })),
      kontekstId: kontekstKandidater.length === 1 ? kontekstKandidater[0].id : null,
      kontekstKandidater: kontekstKandidater.map((k) => ({ id: k.id, navn: k.navn, type: k.type })),
    });
  }

  return { leverandor: ekstrahert.leverandor, kunde: ekstrahert.kunde, dato: ekstrahert.dato, forslag, merknader };
}
