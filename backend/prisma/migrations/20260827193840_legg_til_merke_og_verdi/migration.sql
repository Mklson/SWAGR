-- AlterTable
ALTER TABLE "bevegelser" ADD COLUMN     "verdi_ore" INTEGER;

-- AlterTable
ALTER TABLE "varianter" ADD COLUMN     "merke_id" TEXT,
ADD COLUMN     "verdi_ore" INTEGER;

-- CreateTable
CREATE TABLE "merker" (
    "id" TEXT NOT NULL,
    "navn" TEXT NOT NULL,
    "logo_url" TEXT,

    CONSTRAINT "merker_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "merker_navn_key" ON "merker"("navn");

-- CreateIndex
CREATE INDEX "varianter_merke_id_idx" ON "varianter"("merke_id");

-- AddForeignKey
ALTER TABLE "varianter" ADD CONSTRAINT "varianter_merke_id_fkey" FOREIGN KEY ("merke_id") REFERENCES "merker"("id") ON DELETE SET NULL ON UPDATE CASCADE;
