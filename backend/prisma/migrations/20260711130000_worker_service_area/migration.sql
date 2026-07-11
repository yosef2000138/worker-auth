ALTER TABLE "workers"
  ADD COLUMN "primaryServiceCity" TEXT,
  ADD COLUMN "additionalServiceCities" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "serviceRadiusKm" INTEGER,
  ADD COLUMN "baseLatitude" DOUBLE PRECISION,
  ADD COLUMN "baseLongitude" DOUBLE PRECISION;

ALTER TABLE "service_requests"
  ADD COLUMN "serviceCity" TEXT;

CREATE INDEX "workers_primaryServiceCity_idx" ON "workers"("primaryServiceCity");
CREATE INDEX "service_requests_serviceCity_idx" ON "service_requests"("serviceCity");
