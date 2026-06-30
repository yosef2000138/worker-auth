CREATE TABLE "worker_acceptance_usages" (
  "id" TEXT NOT NULL,
  "workerId" TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "worker_acceptance_usages_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "worker_acceptance_usages_requestId_key" ON "worker_acceptance_usages"("requestId");
CREATE INDEX "worker_acceptance_usages_workerId_idx" ON "worker_acceptance_usages"("workerId");

ALTER TABLE "worker_acceptance_usages"
ADD CONSTRAINT "worker_acceptance_usages_workerId_fkey"
FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "worker_acceptance_usages"
ADD CONSTRAINT "worker_acceptance_usages_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "worker_acceptance_usages" ("id", "workerId", "requestId", "createdAt")
SELECT "id", "workerId", "id", COALESCE("updatedAt", "createdAt")
FROM "service_requests"
WHERE "workerId" IS NOT NULL
  AND "status" IN ('ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED')
ON CONFLICT ("requestId") DO NOTHING;
