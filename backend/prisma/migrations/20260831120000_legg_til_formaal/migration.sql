-- DropForeignKey
ALTER TABLE "bevegelser" DROP CONSTRAINT "bevegelser_kontekst_id_fkey";

-- DropForeignKey
ALTER TABLE "reservasjoner" DROP CONSTRAINT "reservasjoner_kontekst_id_fkey";

-- AlterTable
ALTER TABLE "bevegelser" ADD COLUMN     "formaal_id" TEXT,
ALTER COLUMN "kontekst_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "reservasjoner" ADD COLUMN     "formaal_id" TEXT,
ALTER COLUMN "kontekst_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "formaal" (
    "id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "opprettet" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "formaal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "formaal_navn_key" ON "formaal"("navn");

-- AddForeignKey
ALTER TABLE "bevegelser" ADD CONSTRAINT "bevegelser_kontekst_id_fkey" FOREIGN KEY ("kontekst_id") REFERENCES "kontekster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bevegelser" ADD CONSTRAINT "bevegelser_formaal_id_fkey" FOREIGN KEY ("formaal_id") REFERENCES "formaal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservasjoner" ADD CONSTRAINT "reservasjoner_kontekst_id_fkey" FOREIGN KEY ("kontekst_id") REFERENCES "kontekster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservasjoner" ADD CONSTRAINT "reservasjoner_formaal_id_fkey" FOREIGN KEY ("formaal_id") REFERENCES "formaal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

