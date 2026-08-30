-- AlterTable
ALTER TABLE "brukere" ADD COLUMN     "epost" TEXT,
ADD COLUMN     "passord_hash" TEXT;

-- CreateTable
CREATE TABLE "inviterte_eposter" (
    "id" TEXT NOT NULL,
    "epost" TEXT NOT NULL,
    "rolle" TEXT NOT NULL DEFAULT 'ansatt',
    "brukt" BOOLEAN NOT NULL DEFAULT false,
    "opprettet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inviterte_eposter_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inviterte_eposter_epost_key" ON "inviterte_eposter"("epost");

-- CreateIndex
CREATE UNIQUE INDEX "brukere_epost_key" ON "brukere"("epost");

