-- CreateEnum
CREATE TYPE "ReservasjonStatus" AS ENUM ('aktiv', 'kansellert', 'fullfort');

-- CreateTable
CREATE TABLE "reservasjoner" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "lokasjon_id" TEXT NOT NULL,
    "kontekst_id" TEXT NOT NULL,
    "bruker_id" TEXT NOT NULL,
    "antall" INTEGER NOT NULL,
    "status" "ReservasjonStatus" NOT NULL DEFAULT 'aktiv',
    "til_dato" TIMESTAMP(3),
    "opprettet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reservasjoner_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservasjoner_variant_id_lokasjon_id_status_idx" ON "reservasjoner"("variant_id", "lokasjon_id", "status");

-- AddForeignKey
ALTER TABLE "reservasjoner" ADD CONSTRAINT "reservasjoner_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "varianter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservasjoner" ADD CONSTRAINT "reservasjoner_lokasjon_id_fkey" FOREIGN KEY ("lokasjon_id") REFERENCES "lokasjoner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservasjoner" ADD CONSTRAINT "reservasjoner_kontekst_id_fkey" FOREIGN KEY ("kontekst_id") REFERENCES "kontekster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservasjoner" ADD CONSTRAINT "reservasjoner_bruker_id_fkey" FOREIGN KEY ("bruker_id") REFERENCES "brukere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
