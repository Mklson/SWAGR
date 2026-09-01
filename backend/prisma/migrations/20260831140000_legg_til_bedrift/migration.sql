-- Multi-tenant: Bedrift + BrukerBedrift, bedrift_id på all forretningsdata.
-- Backfyller alt eksisterende til én standardbedrift ("Brand Partners").

-- 1. Nye tabeller
CREATE TABLE "bedrifter" (
    "id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "opprettet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bedrifter_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "bedrifter_navn_key" ON "bedrifter"("navn");

CREATE TABLE "bruker_bedrift" (
    "bruker_id" TEXT NOT NULL,
    "bedrift_id" TEXT NOT NULL,
    "rolle" TEXT NOT NULL DEFAULT 'ansatt',
    "opprettet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bruker_bedrift_pkey" PRIMARY KEY ("bruker_id","bedrift_id")
);

-- 2. Standardbedrift (fast id så backfyll og senere kode kan referere den)
INSERT INTO "bedrifter" ("id","navn","opprettet")
VALUES ('b7a11d00-0000-4000-8000-000000000001','Brand Partners', now());

-- 3. bedrift_id-kolonner (nullbare først, så backfyll, så NOT NULL)
ALTER TABLE "leverandorer"      ADD COLUMN "bedrift_id" TEXT;
ALTER TABLE "varer"             ADD COLUMN "bedrift_id" TEXT;
ALTER TABLE "varianter"         ADD COLUMN "bedrift_id" TEXT;
ALTER TABLE "merker"            ADD COLUMN "bedrift_id" TEXT;
ALTER TABLE "lokasjoner"        ADD COLUMN "bedrift_id" TEXT;
ALTER TABLE "kontekster"        ADD COLUMN "bedrift_id" TEXT;
ALTER TABLE "formaal"           ADD COLUMN "bedrift_id" TEXT;
ALTER TABLE "inviterte_eposter" ADD COLUMN "bedrift_id" TEXT;
ALTER TABLE "bevegelser"        ADD COLUMN "bedrift_id" TEXT;
ALTER TABLE "reservasjoner"     ADD COLUMN "bedrift_id" TEXT;

UPDATE "leverandorer"      SET "bedrift_id" = 'b7a11d00-0000-4000-8000-000000000001' WHERE "bedrift_id" IS NULL;
UPDATE "varer"             SET "bedrift_id" = 'b7a11d00-0000-4000-8000-000000000001' WHERE "bedrift_id" IS NULL;
UPDATE "varianter"         SET "bedrift_id" = 'b7a11d00-0000-4000-8000-000000000001' WHERE "bedrift_id" IS NULL;
UPDATE "merker"            SET "bedrift_id" = 'b7a11d00-0000-4000-8000-000000000001' WHERE "bedrift_id" IS NULL;
UPDATE "lokasjoner"        SET "bedrift_id" = 'b7a11d00-0000-4000-8000-000000000001' WHERE "bedrift_id" IS NULL;
UPDATE "kontekster"        SET "bedrift_id" = 'b7a11d00-0000-4000-8000-000000000001' WHERE "bedrift_id" IS NULL;
UPDATE "formaal"           SET "bedrift_id" = 'b7a11d00-0000-4000-8000-000000000001' WHERE "bedrift_id" IS NULL;
UPDATE "inviterte_eposter" SET "bedrift_id" = 'b7a11d00-0000-4000-8000-000000000001' WHERE "bedrift_id" IS NULL;
UPDATE "bevegelser"        SET "bedrift_id" = 'b7a11d00-0000-4000-8000-000000000001' WHERE "bedrift_id" IS NULL;
UPDATE "reservasjoner"     SET "bedrift_id" = 'b7a11d00-0000-4000-8000-000000000001' WHERE "bedrift_id" IS NULL;

ALTER TABLE "leverandorer"      ALTER COLUMN "bedrift_id" SET NOT NULL;
ALTER TABLE "varer"             ALTER COLUMN "bedrift_id" SET NOT NULL;
ALTER TABLE "varianter"         ALTER COLUMN "bedrift_id" SET NOT NULL;
ALTER TABLE "merker"            ALTER COLUMN "bedrift_id" SET NOT NULL;
ALTER TABLE "lokasjoner"        ALTER COLUMN "bedrift_id" SET NOT NULL;
ALTER TABLE "kontekster"        ALTER COLUMN "bedrift_id" SET NOT NULL;
ALTER TABLE "formaal"           ALTER COLUMN "bedrift_id" SET NOT NULL;
ALTER TABLE "inviterte_eposter" ALTER COLUMN "bedrift_id" SET NOT NULL;
ALTER TABLE "bevegelser"        ALTER COLUMN "bedrift_id" SET NOT NULL;
ALTER TABLE "reservasjoner"     ALTER COLUMN "bedrift_id" SET NOT NULL;

-- 4. Flytt rolle fra brukere til bruker_bedrift (admin beholdes, resten -> ansatt)
INSERT INTO "bruker_bedrift" ("bruker_id","bedrift_id","rolle","opprettet")
SELECT "id",
       'b7a11d00-0000-4000-8000-000000000001',
       CASE WHEN "rolle" = 'admin' THEN 'admin' ELSE 'ansatt' END,
       now()
FROM "brukere";
ALTER TABLE "brukere" DROP COLUMN "rolle";

-- 5. Erstatt globale unike indekser med per-bedrift
DROP INDEX "formaal_navn_key";
DROP INDEX "inviterte_eposter_epost_key";
DROP INDEX "merker_navn_key";
DROP INDEX "varianter_sku_key";

CREATE INDEX "leverandorer_bedrift_id_idx" ON "leverandorer"("bedrift_id");
CREATE INDEX "varer_bedrift_id_idx" ON "varer"("bedrift_id");
CREATE INDEX "varianter_bedrift_id_idx" ON "varianter"("bedrift_id");
CREATE INDEX "lokasjoner_bedrift_id_idx" ON "lokasjoner"("bedrift_id");
CREATE INDEX "kontekster_bedrift_id_idx" ON "kontekster"("bedrift_id");
CREATE INDEX "bevegelser_bedrift_id_idx" ON "bevegelser"("bedrift_id");
CREATE INDEX "reservasjoner_bedrift_id_idx" ON "reservasjoner"("bedrift_id");
CREATE UNIQUE INDEX "merker_bedrift_id_navn_key" ON "merker"("bedrift_id","navn");
CREATE UNIQUE INDEX "formaal_bedrift_id_navn_key" ON "formaal"("bedrift_id","navn");
CREATE UNIQUE INDEX "varianter_bedrift_id_sku_key" ON "varianter"("bedrift_id","sku");
CREATE UNIQUE INDEX "inviterte_eposter_bedrift_id_epost_key" ON "inviterte_eposter"("bedrift_id","epost");

-- 6. Fremmednøkler
ALTER TABLE "bruker_bedrift" ADD CONSTRAINT "bruker_bedrift_bruker_id_fkey" FOREIGN KEY ("bruker_id") REFERENCES "brukere"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bruker_bedrift" ADD CONSTRAINT "bruker_bedrift_bedrift_id_fkey" FOREIGN KEY ("bedrift_id") REFERENCES "bedrifter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "leverandorer" ADD CONSTRAINT "leverandorer_bedrift_id_fkey" FOREIGN KEY ("bedrift_id") REFERENCES "bedrifter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "varer" ADD CONSTRAINT "varer_bedrift_id_fkey" FOREIGN KEY ("bedrift_id") REFERENCES "bedrifter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "merker" ADD CONSTRAINT "merker_bedrift_id_fkey" FOREIGN KEY ("bedrift_id") REFERENCES "bedrifter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "varianter" ADD CONSTRAINT "varianter_bedrift_id_fkey" FOREIGN KEY ("bedrift_id") REFERENCES "bedrifter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "lokasjoner" ADD CONSTRAINT "lokasjoner_bedrift_id_fkey" FOREIGN KEY ("bedrift_id") REFERENCES "bedrifter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "kontekster" ADD CONSTRAINT "kontekster_bedrift_id_fkey" FOREIGN KEY ("bedrift_id") REFERENCES "bedrifter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "formaal" ADD CONSTRAINT "formaal_bedrift_id_fkey" FOREIGN KEY ("bedrift_id") REFERENCES "bedrifter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inviterte_eposter" ADD CONSTRAINT "inviterte_eposter_bedrift_id_fkey" FOREIGN KEY ("bedrift_id") REFERENCES "bedrifter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bevegelser" ADD CONSTRAINT "bevegelser_bedrift_id_fkey" FOREIGN KEY ("bedrift_id") REFERENCES "bedrifter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reservasjoner" ADD CONSTRAINT "reservasjoner_bedrift_id_fkey" FOREIGN KEY ("bedrift_id") REFERENCES "bedrifter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
