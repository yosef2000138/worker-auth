import { Server, Socket } from 'socket.io';
import { db } from '../config/database';

export function registerChatHandlers(io: Server, socket: Socket) {
  const userId = socket.data.userId as string;

  // Join a request-specific chat room
  socket.on('chat:join', async (requestId: string) => {
    // Verify the user is a participant
    const request = await db.serviceRequest.findUnique({
      where: { id: requestId },
      include: { worker: true },
    });

    if (!request) {
      socket.emit('chat:error', { message: 'Request not found' });
      return;
    }

    const isCustomer = request.customerId === userId;
    const isWorker = request.worker?.userId === userId;

    if (!isCustomer && !isWorker) {
      socket.emit('chat:error', { message: 'Not a participant in this conversation' });
      return;
    }

    socket.join(`chat:${requestId}`);
    socket.emit('chat:joined', { requestId });
  });

  // Send a message via socket (persists to DB + broadcasts)
  socket.on('chat:message', async (payload: { requestId: string; content: string }) => {
    const { requestId, content } = payload;

    if (!content?.trim()) {
      socket.emit('chat:error', { message: 'Message content cannot be empty' });
      return;
    }

    // Only participants can send
    const request = await db.serviceRequest.findUnique({
      where: { id: requestId },
      include: { worker: true },
    });

    if (!request) {
      socket.emit('chat:error', { message: 'Request not found' });
      return;
    }

    const isCustomer = request.customerId === userId;
    const isWorker = request.worker?.userId === userId;

    if (!isCustomer && !isWorker) {
      socket.emit('chat:error', { message: 'Not a participant' });
      return;
    }

    // Persist to database
    const message = await db.message.create({
      data: { requestId, senderId: userId, content: content.trim() },
      select: {
        id: true,
        content: true,
        isRead: true,
        createdAt: true,
        sender: { select: { id: true, fullName: true, avatarUrl: true, role: true } },
      },
    });

    // Broadcast to all room members (including sender)
    io.to(`chat:${requestId}`).emit('chat:message', { requestId, message });
  });

  // Leave chat room
  socket.on('chat:leave', (requestId: string) => {
    socket.leave(`chat:${requestId}`);
    socket.emit('chat:left', { requestId });
  });

  // Typing indicator (fire-and-forget, no DB)
  socket.on('chat:typing', (requestId: string) => {
    socket.to(`chat:${requestId}`).emit('chat:typing', { userId, requestId });
  });

  socket.on('chat:stop-typing', (requestId: string) => {
    socket.to(`chat:${requestId}`).emit('chat:stop-typing', { userId, requestId });
  });
}
