CREATE INDEX IF NOT EXISTS "request_images_requestId_order_idx"
  ON "request_images"("requestId", "order");

CREATE INDEX IF NOT EXISTS "service_requests_customerId_status_createdAt_idx"
  ON "service_requests"("customerId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "service_requests_workerId_status_createdAt_idx"
  ON "service_requests"("workerId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "service_requests_status_categoryId_createdAt_idx"
  ON "service_requests"("status", "categoryId", "createdAt");

CREATE INDEX IF NOT EXISTS "service_requests_serviceCity_status_createdAt_idx"
  ON "service_requests"("serviceCity", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "request_offers_requestId_workerId_status_idx"
  ON "request_offers"("requestId", "workerId", "status");

CREATE INDEX IF NOT EXISTS "messages_requestId_createdAt_idx"
  ON "messages"("requestId", "createdAt");

CREATE INDEX IF NOT EXISTS "notifications_userId_isRead_createdAt_idx"
  ON "notifications"("userId", "isRead", "createdAt");

CREATE INDEX IF NOT EXISTS "worker_availability_workerId_dayOfWeek_idx"
  ON "worker_availability"("workerId", "dayOfWeek");
