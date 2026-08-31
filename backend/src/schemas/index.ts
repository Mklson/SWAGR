import { z } from "zod";

export const leverandorCreateSchema = z.object({
  navn: z.string().min(1),
});

export const vareCreateSchema = z.object({
  navn: z.string().min(1),
  kategori: z.string().min(1),
  leverandorId: z.string().uuid(),
});

export const vareUpdateSchema = z
  .object({
    navn: z.string().min(1),
    kategori: z.string().min(1),
    leverandorId: z.string().uuid(),
  })
  .partial();

export const vareIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const merkeCreateSchema = z.object({
  navn: z.string().min(1),
  logoUrl: z.string().url().optional(),
});

export const variantCreateSchema = z.object({
  vareId: z.string().uuid(),
  attributter: z.record(z.unknown()).default({}),
  sku: z.string().min(1),
  bildeurl: z.string().url().optional(),
  merkeId: z.string().uuid().optional(),
  verdiOre: z.number().int().nonnegative().optional(),
});

export const variantUpdateSchema = z
  .object({
    bildeurl: z.string().url().nullable(),
    merkeId: z.string().uuid().nullable(),
    verdiOre: z.number().int().nonnegative().nullable(),
  })
  .partial();

export const variantIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const lokasjonCreateSchema = z.object({
  navn: z.string().min(1),
  type: z.string().min(1),
});

export const kontekstTypeSchema = z.enum([
  "kunde",
  "prosjekt",
  "internbruk",
  "svinn",
  "retur",
  "innkjop",
]);

export const kontekstCreateSchema = z.object({
  type: kontekstTypeSchema,
  navn: z.string().min(1),
  referanse: z.string().optional(),
});

export const brukerCreateSchema = z.object({
  navn: z.string().min(1),
  rolle: z.string().min(1),
});

export const bevegelseTypeSchema = z.enum([
  "inn",
  "ut",
  "svinn",
  "retur",
  "internbruk",
]);

export const bevegelseCreateSchema = z.object({
  variantId: z.string().uuid(),
  lokasjonId: z.string().uuid(),
  kontekstId: z.string().uuid(),
  brukerId: z.string().uuid(),
  type: bevegelseTypeSchema,
  antall: z.number().int().positive(),
  tidspunkt: z.coerce.date().optional(),
});

export const bevegelseListQuerySchema = z.object({
  variantId: z.string().uuid().optional(),
  lokasjonId: z.string().uuid().optional(),
  kontekstId: z.string().uuid().optional(),
});

export const beholdningQuerySchema = z.object({
  variantId: z.string().uuid().optional(),
  lokasjonId: z.string().uuid().optional(),
});

export const rapportKontekstParamsSchema = z.object({
  kontekstId: z.string().uuid(),
});

export const rapportKontekstQuerySchema = z.object({
  variantId: z.string().uuid().optional(),
  fra: z.coerce.date().optional(),
  til: z.coerce.date().optional(),
});

export const rapportFleksibelQuerySchema = z.object({
  kontekstId: z.string().uuid().optional(),
  merkeId: z.string().uuid().optional(),
  fra: z.coerce.date().optional(),
  til: z.coerce.date().optional(),
});

export const rapportPeriodeQuerySchema = z.object({
  variantId: z.string().uuid().optional(),
  lokasjonId: z.string().uuid().optional(),
  kontekstId: z.string().uuid().optional(),
  fra: z.coerce.date().optional(),
  til: z.coerce.date().optional(),
});

export const reservasjonStatusSchema = z.enum(["aktiv", "kansellert", "fullfort"]);

export const reservasjonCreateSchema = z.object({
  variantId: z.string().uuid(),
  lokasjonId: z.string().uuid(),
  kontekstId: z.string().uuid(),
  brukerId: z.string().uuid(),
  antall: z.number().int().positive(),
  tilDato: z.coerce.date().optional(),
});

export const reservasjonListQuerySchema = z.object({
  variantId: z.string().uuid().optional(),
  lokasjonId: z.string().uuid().optional(),
  status: reservasjonStatusSchema.optional(),
});

export const reservasjonIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const sporsmalSchema = z.object({
  sporsmal: z.string().min(1),
});

export const fakturaMediaTypeSchema = z.enum([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

export const fakturaTolkSchema = z.object({
  fil: z.string().min(1),
  mediaType: fakturaMediaTypeSchema,
  lokasjonId: z.string().uuid(),
});

export const bildeMediaTypeSchema = z.enum(["image/png", "image/jpeg", "image/webp"]);

export const variantGjenkjennSchema = z.object({
  fil: z.string().min(1),
  mediaType: bildeMediaTypeSchema,
});

export const registrerSchema = z.object({
  epost: z.string().email(),
  passord: z.string().min(8),
  navn: z.string().min(1),
});

export const loggInnSchema = z.object({
  epost: z.string().email(),
  passord: z.string().min(1),
});

export const invitertCreateSchema = z.object({
  epost: z.string().email(),
  rolle: z.string().min(1).optional(),
});

export const invitertIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const bildeOpplastingSchema = z.object({
  fil: z.string().min(1),
  mediaType: bildeMediaTypeSchema,
});
