-- CreateEnum
CREATE TYPE "RequestOfferStatus" AS ENUM ('SUBMITTED', 'DISCUSSING', 'SELECTED', 'NOT_SELECTED', 'WITHDRAWN', 'EXPIRED');

-- CreateTable
CREATE TABLE "request_offers" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "proposedPrice" DECIMAL(10,2),
    "message" TEXT,
    "availableAt" TIMESTAMP(3),
    "estimatedDuration" TEXT,
    "status" "RequestOfferStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "request_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "offer_messages" (
    "id" TEXT NOT NULL,
    "offerId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "offer_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "request_offers_requestId_workerId_key" ON "request_offers"("requestId", "workerId");

-- CreateIndex
CREATE INDEX "request_offers_requestId_status_createdAt_idx" ON "request_offers"("requestId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "request_offers_workerId_status_createdAt_idx" ON "request_offers"("workerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "offer_messages_offerId_createdAt_idx" ON "offer_messages"("offerId", "createdAt");

-- CreateIndex
CREATE INDEX "offer_messages_senderId_idx" ON "offer_messages"("senderId");

-- AddForeignKey
ALTER TABLE "request_offers" ADD CONSTRAINT "request_offers_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "service_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_offers" ADD CONSTRAINT "request_offers_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "workers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_messages" ADD CONSTRAINT "offer_messages_offerId_fkey" FOREIGN KEY ("offerId") REFERENCES "request_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "offer_messages" ADD CONSTRAINT "offer_messages_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
