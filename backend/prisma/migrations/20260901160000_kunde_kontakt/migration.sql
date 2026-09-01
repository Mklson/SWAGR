-- Kundeopplysninger på kontekst (brukt til plukklister). Alle valgfrie.
ALTER TABLE "kontekster" ADD COLUMN "firma" TEXT;
ALTER TABLE "kontekster" ADD COLUMN "kontaktperson" TEXT;
ALTER TABLE "kontekster" ADD COLUMN "adresse" TEXT;
ALTER TABLE "kontekster" ADD COLUMN "epost" TEXT;
ALTER TABLE "kontekster" ADD COLUMN "telefon" TEXT;
