-- Add a deterministic duplicate key for active requests. The column stays NULL
-- for terminal requests so customers can create a future request after a job is
-- completed or cancelled.
ALTER TABLE "service_requests" ADD COLUMN "activeJobKey" TEXT;

WITH normalized AS (
  SELECT
    "id",
    "customerId"
      || '|'
      || "categoryId"
      || '|'
      || regexp_replace(lower(trim("title")), '\s+', ' ', 'g')
      || '|'
      || regexp_replace(lower(trim("description")), '\s+', ' ', 'g')
      || '|'
      || CASE
        WHEN "address" IS NOT NULL AND length(trim("address")) > 0
          THEN 'ADDR:' || regexp_replace(lower(trim("address")), '\s+', ' ', 'g')
        WHEN "lat" IS NOT NULL AND "lng" IS NOT NULL AND NOT ("lat" = 0 AND "lng" = 0)
          THEN 'COORD:' || to_char(round(("lat")::numeric, 3), 'FM999999990.000') || ',' || to_char(round(("lng")::numeric, 3), 'FM999999990.000')
        ELSE 'NO_LOCATION'
      END AS key
  FROM "service_requests"
  WHERE "status" IN ('PENDING', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS')
),
ranked AS (
  SELECT
    "id",
    key,
    row_number() OVER (PARTITION BY key ORDER BY "id") AS duplicate_rank
  FROM normalized
)
UPDATE "service_requests"
SET "activeJobKey" = ranked.key
FROM ranked
WHERE "service_requests"."id" = ranked."id"
  AND ranked.duplicate_rank = 1;

CREATE UNIQUE INDEX "service_requests_activeJobKey_key" ON "service_requests"("activeJobKey");
