-- RevenueCat-backed Worker Pro subscription preparation.
-- This migration stores verified provider subscription state only.
-- It does not create fake subscriptions, reset data, or enable paid access.

-- CreateEnum
CREATE TYPE "SubscriptionProvider" AS ENUM ('REVENUECAT');

-- CreateEnum
CREATE TYPE "SubscriptionPlatform" AS ENUM ('ANDROID', 'IOS', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "SubscriptionEnvironment" AS ENUM ('SANDBOX', 'PRODUCTION');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM (
  'ACTIVE',
  'TRIAL',
  'GRACE_PERIOD',
  'BILLING_ISSUE',
  'CANCELLED',
  'EXPIRED',
  'REFUNDED',
  'UNKNOWN'
);

-- CreateTable
CREATE TABLE "user_subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" "SubscriptionProvider" NOT NULL DEFAULT 'REVENUECAT',
    "entitlementId" TEXT NOT NULL,
    "storeProductId" TEXT,
    "platform" "SubscriptionPlatform" NOT NULL DEFAULT 'UNKNOWN',
    "environment" "SubscriptionEnvironment" NOT NULL DEFAULT 'SANDBOX',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'UNKNOWN',
    "originalTransactionId" TEXT,
    "appUserId" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "originalPurchaseDate" TIMESTAMP(3),
    "expirationDate" TIMESTAMP(3),
    "willRenew" BOOLEAN,
    "cancellationDate" TIMESTAMP(3),
    "billingIssueDate" TIMESTAMP(3),
    "lastEventId" TEXT,
    "lastEventType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_webhook_events" (
    "id" TEXT NOT NULL,
    "provider" "SubscriptionProvider" NOT NULL DEFAULT 'REVENUECAT',
    "providerEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_webhook_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_subscriptions_provider_originalTransactionId_key" ON "user_subscriptions"("provider", "originalTransactionId");

-- CreateIndex
CREATE INDEX "user_subscriptions_userId_provider_entitlementId_idx" ON "user_subscriptions"("userId", "provider", "entitlementId");

-- CreateIndex
CREATE INDEX "user_subscriptions_appUserId_idx" ON "user_subscriptions"("appUserId");

-- CreateIndex
CREATE INDEX "user_subscriptions_status_idx" ON "user_subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "subscription_webhook_events_provider_providerEventId_key" ON "subscription_webhook_events"("provider", "providerEventId");

-- AddForeignKey
ALTER TABLE "user_subscriptions" ADD CONSTRAINT "user_subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
