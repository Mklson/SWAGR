-- Global administrator-flagg: admin i alle bedrifter uavhengig av BrukerBedrift-rolle.
ALTER TABLE "brukere" ADD COLUMN "superadmin" BOOLEAN NOT NULL DEFAULT false;
