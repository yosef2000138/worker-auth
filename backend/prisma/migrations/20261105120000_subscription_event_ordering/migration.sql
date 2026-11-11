ALTER TABLE "user_subscriptions"
ADD COLUMN "lastEventAt" TIMESTAMP(3);

ALTER TABLE "subscription_webhook_events"
ADD COLUMN "eventTimestamp" TIMESTAMP(3);
