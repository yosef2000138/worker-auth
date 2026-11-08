import { Prisma } from '@prisma/client';
import { db } from '../config/database';
import { pushToUser } from '../utils/fcm';
import { logger } from '../utils/logger';

export interface NotificationJobPayload {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Persist a notification to DB, push via FCM, and (if Socket.IO is ready)
 * emit in real-time.
 *
 * This is intentionally kept simple (in-process, no queue).
 * Replace the body with a Bull/BullMQ job enqueue when you're ready to scale.
 */
export async function dispatchNotification(payload: NotificationJobPayload): Promise<void> {
  const { userId, type, title, body, data } = payload;

  try {
    // 1. Persist to DB — cast data to Prisma InputJsonValue to satisfy strict JSON typing
    const notification = await db.notification.create({
      data: {
        userId,
        type,
        title,
        body,
        ...(data !== undefined && { data: data as Prisma.InputJsonValue }),
      },
      select: {
        id: true, type: true, title: true, body: true,
        isRead: true, data: true, createdAt: true,
      },
    });

    // 2. Push via FCM (fire-and-forget)
    pushToUser(userId, title, body, { ...(data ?? {}), notificationId: notification.id })
      .catch(() => logger.error('notification.push_failed', { userId, type }));

    // 3. Emit via Socket.IO if available (lazy import to avoid circular deps)
    try {
      const { getIO } = await import('../sockets/index');
      const { emitNotification } = await import('../sockets/notification.handler');
      emitNotification(getIO(), userId, notification);
    } catch {
      // Socket.IO may not be initialised in test environments — that's fine
    }
  } catch {
    logger.error('notification.dispatch_failed', { userId, type });
    // Do not rethrow — notification failure should never crash the main flow
  }
}

/**
 * Convenience wrappers for common notification types.
 */
export const NotifyJob = {
  requestAccepted: (customerId: string, requestTitle: string, requestId: string) =>
    dispatchNotification({
      userId: customerId,
      type: 'REQUEST_ACCEPTED',
      title: 'Request Accepted 🎉',
      body: `A worker has accepted your request: "${requestTitle}"`,
      data: { requestId },
    }),

  workerOnTheWay: (customerId: string, requestId: string) =>
    dispatchNotification({
      userId: customerId,
      type: 'WORKER_ON_THE_WAY',
      title: 'Worker is on the way 🚗',
      body: 'Your worker is heading to your location.',
      data: { requestId },
    }),

  jobStarted: (customerId: string, requestId: string) =>
    dispatchNotification({
      userId: customerId,
      type: 'JOB_STARTED',
      title: 'Job started 🔧',
      body: 'Your service is now in progress.',
      data: { requestId },
    }),

  jobCompleted: (customerId: string, requestId: string) =>
    dispatchNotification({
      userId: customerId,
      type: 'JOB_COMPLETED',
      title: 'Job completed ✅',
      body: 'Your service is complete. Please leave a review!',
      data: { requestId },
    }),

  requestCancelled: (userId: string, requestId: string, reason?: string) =>
    dispatchNotification({
      userId,
      type: 'REQUEST_CANCELLED',
      title: 'Request Cancelled',
      body: reason ?? 'A request has been cancelled.',
      data: { requestId },
    }),

  newMessage: (recipientId: string, senderName: string, requestId: string) =>
    dispatchNotification({
      userId: recipientId,
      type: 'NEW_MESSAGE',
      title: `New message from ${senderName}`,
      body: 'Tap to view the conversation.',
      data: { requestId },
    }),

  newRequestAvailable: (workerId: string, categoryName: string, requestId: string) =>
    dispatchNotification({
      userId: workerId,
      type: 'NEW_REQUEST',
      title: `New ${categoryName} request nearby`,
      body: 'A new job is available in your area.',
      data: { requestId },
    }),
};
