import type { BevegelseType } from "@prisma/client";

/**
 * Fortegn brukt til å beregne beholdning fra Bevegelse-linjer.
 * inn/retur øker beholdning, ut/svinn/internbruk reduserer den.
 * Ikke spesifisert i arkitekturdokumentet — avklart her som eneste kilde til sannhet.
 */
export const BEVEGELSE_FORTEGN: Record<BevegelseType, 1 | -1> = {
  inn: 1,
  retur: 1,
  ut: -1,
  svinn: -1,
  internbruk: -1,
};
