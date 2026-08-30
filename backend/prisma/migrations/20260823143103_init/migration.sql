-- CreateEnum
CREATE TYPE "BevegelseType" AS ENUM ('inn', 'ut', 'svinn', 'retur', 'internbruk');

-- CreateEnum
CREATE TYPE "KontekstType" AS ENUM ('kunde', 'prosjekt', 'internbruk', 'svinn', 'retur');

-- CreateTable
CREATE TABLE "leverandorer" (
    "id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,

    CONSTRAINT "leverandorer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "varer" (
    "id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "kategori" TEXT NOT NULL,
    "leverandor_id" TEXT NOT NULL,

    CONSTRAINT "varer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "varianter" (
    "id" TEXT NOT NULL,
    "vare_id" TEXT NOT NULL,
    "attributter" JSONB NOT NULL DEFAULT '{}',
    "sku" TEXT NOT NULL,
    "bildeurl" TEXT,

    CONSTRAINT "varianter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lokasjoner" (
    "id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "type" TEXT NOT NULL,

    CONSTRAINT "lokasjoner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kontekster" (
    "id" TEXT NOT NULL,
    "type" "KontekstType" NOT NULL,
    "navn" TEXT NOT NULL,
    "referanse" TEXT,

    CONSTRAINT "kontekster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brukere" (
    "id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "rolle" TEXT NOT NULL,

    CONSTRAINT "brukere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bevegelser" (
    "id" TEXT NOT NULL,
    "variant_id" TEXT NOT NULL,
    "lokasjon_id" TEXT NOT NULL,
    "kontekst_id" TEXT NOT NULL,
    "bruker_id" TEXT NOT NULL,
    "type" "BevegelseType" NOT NULL,
    "antall" INTEGER NOT NULL,
    "tidspunkt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bevegelser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "varianter_sku_key" ON "varianter"("sku");

-- CreateIndex
CREATE INDEX "varianter_vare_id_idx" ON "varianter"("vare_id");

-- CreateIndex
CREATE INDEX "bevegelser_variant_id_lokasjon_id_tidspunkt_idx" ON "bevegelser"("variant_id", "lokasjon_id", "tidspunkt");

-- AddForeignKey
ALTER TABLE "varer" ADD CONSTRAINT "varer_leverandor_id_fkey" FOREIGN KEY ("leverandor_id") REFERENCES "leverandorer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "varianter" ADD CONSTRAINT "varianter_vare_id_fkey" FOREIGN KEY ("vare_id") REFERENCES "varer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bevegelser" ADD CONSTRAINT "bevegelser_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "varianter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bevegelser" ADD CONSTRAINT "bevegelser_lokasjon_id_fkey" FOREIGN KEY ("lokasjon_id") REFERENCES "lokasjoner"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bevegelser" ADD CONSTRAINT "bevegelser_kontekst_id_fkey" FOREIGN KEY ("kontekst_id") REFERENCES "kontekster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bevegelser" ADD CONSTRAINT "bevegelser_bruker_id_fkey" FOREIGN KEY ("bruker_id") REFERENCES "brukere"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
