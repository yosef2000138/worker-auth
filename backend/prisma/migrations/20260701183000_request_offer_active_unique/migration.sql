DROP INDEX IF EXISTS "request_offers_requestId_workerId_key";

CREATE UNIQUE INDEX IF NOT EXISTS "request_offers_active_request_worker_unique"
  ON "request_offers" ("requestId", "workerId")
  WHERE "status" IN ('SUBMITTED', 'DISCUSSING');
