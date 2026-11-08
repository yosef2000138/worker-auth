import { db } from '../../config/database';
import { getIO } from '../../sockets';

// ─── Access guard: only customer or assigned worker can chat ─────────────────
export async function assertMessageAccess(requestId: string, userId: string) {
  const request = await db.serviceRequest.findUnique({
    where: { id: requestId },
    include: { worker: true },
  });
  if (!request) throw { status: 404, message: 'Request not found' };

  const isCustomer = request.customerId === userId;
  const isWorker = request.worker?.userId === userId;
  if (!isCustomer && !isWorker) {
    throw { status: 403, message: 'Not a participant in this conversation' };
  }
  return request;
}

// ─── List messages ────────────────────────────────────────────────────────────
export async function listMessages(
  requestId: string,
  userId: string,
  options: { before?: string; limit: number },
) {
  await assertMessageAccess(requestId, userId);

  const { before, limit } = options;

  const messages = await db.message.findMany({
    where: {
      requestId,
      ...(before && { createdAt: { lt: new Date(before) } }),
    },
    select: {
      id: true,
      requestId: true,
      senderId: true,
      content: true,
      isRead: true,
      createdAt: true,
      sender: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  return messages.reverse(); // return chronological order
}

// ─── Send message ─────────────────────────────────────────────────────────────
export async function sendMessage(
  requestId: string,
  senderId: string,
  content: string,
) {
  await assertMessageAccess(requestId, senderId);

  const message = await db.message.create({
    data: { requestId, senderId, content },
    select: {
      id: true,
      requestId: true,
      senderId: true,
      content: true,
      isRead: true,
      createdAt: true,
      sender: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
    },
  });

  try {
    getIO().to(`chat:${requestId}`).emit('chat:message', { requestId, message });
  } catch {
    // HTTP message delivery should still succeed if Socket.IO is not ready.
  }

  return message;
}

// ─── Mark messages as read ────────────────────────────────────────────────────
export async function markRead(requestId: string, userId: string) {
  await assertMessageAccess(requestId, userId);

  // Mark all messages NOT sent by this user as read
  const { count } = await db.message.updateMany({
    where: {
      requestId,
      senderId: { not: userId },
      isRead: false,
    },
    data: { isRead: true },
  });

  return { markedRead: count };
}

// ─── Unread count ─────────────────────────────────────────────────────────────
export async function getUnreadCount(userId: string) {
  const count = await db.message.count({
    where: {
      isRead: false,
      senderId: { not: userId },
      request: {
        OR: [
          { customerId: userId },
          { worker: { userId } },
        ],
      },
    },
  });
  return { unreadCount: count };
}
