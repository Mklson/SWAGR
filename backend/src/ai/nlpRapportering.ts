import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod/v4";
import { beregnBeholdning, beregnRapportKontekst, beregnRapportPeriode } from "../lib/rapportBeregning.js";
import { sokKontekst, sokLokasjon, sokVariant } from "../lib/sok.js";

const client = new Anthropic();

const SYSTEM = `Du er en rapporteringsassistent for et varelager-/POS-system. Systemet logger varebevegelser (inn/ut/svinn/retur/internbruk) per variant, lokasjon og kontekst (kunde/prosjekt/internbruk/svinn/retur).

Svar på spørsmål om bevegelser og beholdning ved å:
1. Bruke søkeverktøyene til å finne kontekstId/variantId/lokasjonId for navn nevnt i spørsmålet.
2. Bruke rapport-/beholdningsverktøyene til å hente konkrete tall. Ikke gjett eller regn ut tall selv — hent dem alltid via verktøyene.
3. Hvis et navn gir flere treff eller ingen treff, spør brukeren om avklaring i stedet for å anta.

Svar kort og presist på norsk, og oppgi konkrete tall fra verktøyresultatene.`;

interface ToolKall {
  navn: string;
  input: unknown;
}

function byggVerktoy(bedriftId: string, kall: ToolKall[]) {
  return [
    betaZodTool({
      name: "sok_kontekst",
      description:
        "Søk etter kontekst (kunde/prosjekt/internbruk/svinn/retur) på navn, for å finne kontekstId.",
      inputSchema: z.object({ navn: z.string() }),
      run: async (input) => {
        kall.push({ navn: "sok_kontekst", input });
        return JSON.stringify(await sokKontekst(bedriftId, input.navn));
      },
    }),
    betaZodTool({
      name: "sok_variant",
      description: "Søk etter vare/variant på varenavn eller SKU, for å finne variantId.",
      inputSchema: z.object({ navnEllerSku: z.string() }),
      run: async (input) => {
        kall.push({ navn: "sok_variant", input });
        return JSON.stringify(await sokVariant(bedriftId, input.navnEllerSku));
      },
    }),
    betaZodTool({
      name: "sok_lokasjon",
      description: "Søk etter lokasjon på navn, for å finne lokasjonId.",
      inputSchema: z.object({ navn: z.string() }),
      run: async (input) => {
        kall.push({ navn: "sok_lokasjon", input });
        return JSON.stringify(await sokLokasjon(bedriftId, input.navn));
      },
    }),
    betaZodTool({
      name: "rapport_periode",
      description:
        "Summer bevegelser per type innenfor en periode, filtrerbart på variantId/lokasjonId/kontekstId og fra/til-dato (ISO 8601).",
      inputSchema: z.object({
        variantId: z.string().uuid().optional(),
        lokasjonId: z.string().uuid().optional(),
        kontekstId: z.string().uuid().optional(),
        fra: z.string().optional(),
        til: z.string().optional(),
      }),
      run: async (input) => {
        kall.push({ navn: "rapport_periode", input });
        return JSON.stringify(
          await beregnRapportPeriode({
            bedriftId,
            variantId: input.variantId,
            lokasjonId: input.lokasjonId,
            kontekstId: input.kontekstId,
            fra: input.fra ? new Date(input.fra) : undefined,
            til: input.til ? new Date(input.til) : undefined,
          }),
        );
      },
    }),
    betaZodTool({
      name: "rapport_kontekst",
      description:
        "Summer bevegelser per variant+type for én kontekst, f.eks. 'hvor mye har vi levert til kunde X'. Filtrerbart på variantId og fra/til-dato (ISO 8601).",
      inputSchema: z.object({
        kontekstId: z.string().uuid(),
        variantId: z.string().uuid().optional(),
        fra: z.string().optional(),
        til: z.string().optional(),
      }),
      run: async (input) => {
        kall.push({ navn: "rapport_kontekst", input });
        return JSON.stringify(
          await beregnRapportKontekst(input.kontekstId, {
            bedriftId,
            variantId: input.variantId,
            fra: input.fra ? new Date(input.fra) : undefined,
            til: input.til ? new Date(input.til) : undefined,
          }),
        );
      },
    }),
    betaZodTool({
      name: "beholdning",
      description: "Hent nåværende beregnet beholdning, filtrerbart på variantId/lokasjonId.",
      inputSchema: z.object({
        variantId: z.string().uuid().optional(),
        lokasjonId: z.string().uuid().optional(),
      }),
      run: async (input) => {
        kall.push({ navn: "beholdning", input });
        return JSON.stringify(await beregnBeholdning({ ...input, bedriftId }));
      },
    }),
  ];
}

export interface NlpRapportSvar {
  svar: string;
  verktoyKall: ToolKall[];
}

export async function besvarSporsmal(bedriftId: string, sporsmal: string): Promise<NlpRapportSvar> {
  const verktoyKall: ToolKall[] = [];
  const tools = byggVerktoy(bedriftId, verktoyKall);

  const finalMessage = await client.beta.messages.toolRunner({
    model: "claude-opus-5",
    max_tokens: 4096,
    system: SYSTEM,
    tools,
    messages: [{ role: "user", content: sporsmal }],
  });

  const svar = finalMessage.content
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  return { svar, verktoyKall };
}
