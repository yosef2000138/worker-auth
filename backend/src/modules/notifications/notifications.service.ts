import { Prisma } from '@prisma/client';
import { db } from '../../config/database';

// ─── Create notification (internal helper used by other services) ─────────────
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  data?: Record<string, unknown>,
) {
  return db.notification.create({
    data: {
      userId,
      type,
      title,
      body,
      // Cast to Prisma's InputJsonValue to satisfy strict JSON type checking
      ...(data !== undefined && { data: data as Prisma.InputJsonValue }),
    },
    select: {
      id: true, type: true, title: true, body: true,
      isRead: true, data: true, createdAt: true,
    },
  });
}

// ─── List own notifications ───────────────────────────────────────────────────
export async function listNotifications(
  userId: string,
  options: { page: number; limit: number; unreadOnly: boolean },
) {
  const { page, limit, unreadOnly } = options;
  const skip = (page - 1) * limit;
  const where = {
    userId,
    ...(unreadOnly && { isRead: false }),
  };

  const [total, unreadCount, items] = await Promise.all([
    db.notification.count({ where }),
    db.notification.count({ where: { userId, isRead: false } }),
    db.notification.findMany({
      where,
      select: {
        id: true, type: true, title: true, body: true,
        isRead: true, data: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
  ]);

  return {
    unreadCount,
    items,
    pagination: { total, page, limit, pages: Math.ceil(total / limit) },
  };
}

// ─── Mark one as read ─────────────────────────────────────────────────────────
export async function markOneRead(id: string, userId: string) {
  const notif = await db.notification.findUnique({ where: { id } });
  if (!notif) throw { status: 404, message: 'Notification not found' };
  if (notif.userId !== userId) throw { status: 403, message: 'Not your notification' };

  const updated = await db.notification.update({
    where: { id },
    data: { isRead: true },
    select: { id: true, isRead: true },
  });

  return updated;
}

// ─── Mark all as read ─────────────────────────────────────────────────────────
export async function markAllRead(userId: string) {
  const { count } = await db.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true },
  });
  return { markedRead: count };
}

// ─── Delete one notification ──────────────────────────────────────────────────
export async function deleteNotification(id: string, userId: string) {
  const notif = await db.notification.findUnique({ where: { id } });
  if (!notif) throw { status: 404, message: 'Notification not found' };
  if (notif.userId !== userId) throw { status: 403, message: 'Not your notification' };

  await db.notification.delete({ where: { id } });
  return { message: 'Notification deleted' };
}
