-- Harden request reviews for production use.
-- Existing reviews are preserved; each request can still have only one review.

ALTER TABLE "reviews"
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "reviews"
ADD CONSTRAINT "reviews_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5);

ALTER TABLE "reviews" DROP CONSTRAINT "reviews_requestId_fkey";

ALTER TABLE "reviews"
ADD CONSTRAINT "reviews_requestId_fkey"
FOREIGN KEY ("requestId") REFERENCES "service_requests"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "reviews_revieweeId_createdAt_idx" ON "reviews"("revieweeId", "createdAt");
CREATE INDEX "reviews_reviewerId_createdAt_idx" ON "reviews"("reviewerId", "createdAt");
