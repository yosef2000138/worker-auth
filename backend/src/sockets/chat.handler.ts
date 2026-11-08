import { Server, Socket } from 'socket.io';
import { messageRequestIdSchema, socketMessageSchema } from '../modules/messages/messages.schema';
import { assertMessageAccess, sendMessage } from '../modules/messages/messages.service';

const MESSAGE_WINDOW_MS = 10_000;
const MAX_MESSAGES_PER_WINDOW = 20;

function emitChatError(socket: Socket, code: string, message: string) {
  socket.emit('chat:error', { code, message });
}

function createMessageRateLimiter() {
  let timestamps: number[] = [];

  return () => {
    const cutoff = Date.now() - MESSAGE_WINDOW_MS;
    timestamps = timestamps.filter(timestamp => timestamp > cutoff);
    if (timestamps.length >= MAX_MESSAGES_PER_WINDOW) return false;
    timestamps.push(Date.now());
    return true;
  };
}

export function registerChatHandlers(_io: Server, socket: Socket) {
  const userId = socket.data.userId as string;
  const allowMessage = createMessageRateLimiter();

  socket.on('chat:join', async (rawRequestId: unknown) => {
    const parsed = messageRequestIdSchema.safeParse(rawRequestId);
    if (!parsed.success) {
      emitChatError(socket, 'INVALID_REQUEST_ID', 'Invalid request');
      return;
    }

    try {
      await assertMessageAccess(parsed.data, userId);
      await socket.join(`chat:${parsed.data}`);
      socket.emit('chat:joined', { requestId: parsed.data });
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error
        ? Number(error.status)
        : 500;
      emitChatError(
        socket,
        status === 404 ? 'REQUEST_NOT_FOUND' : 'CHAT_FORBIDDEN',
        status === 404 ? 'Request not found' : 'Not a participant in this conversation',
      );
    }
  });

  socket.on('chat:message', async (rawPayload: unknown) => {
    if (!allowMessage()) {
      emitChatError(socket, 'MESSAGE_RATE_LIMITED', 'Too many messages. Please wait a moment.');
      return;
    }

    const parsed = socketMessageSchema.safeParse(rawPayload);
    if (!parsed.success) {
      emitChatError(socket, 'INVALID_MESSAGE', 'Message must contain 1 to 2000 characters.');
      return;
    }

    try {
      await sendMessage(parsed.data.requestId, userId, parsed.data.content);
    } catch (error) {
      const status = typeof error === 'object' && error !== null && 'status' in error
        ? Number(error.status)
        : 500;
      emitChatError(
        socket,
        status === 404 ? 'REQUEST_NOT_FOUND' : status === 403 ? 'CHAT_FORBIDDEN' : 'MESSAGE_FAILED',
        status === 404
          ? 'Request not found'
          : status === 403
            ? 'Not a participant in this conversation'
            : 'Could not send message',
      );
    }
  });

  socket.on('chat:leave', async (rawRequestId: unknown) => {
    const parsed = messageRequestIdSchema.safeParse(rawRequestId);
    if (!parsed.success) return;
    await socket.leave(`chat:${parsed.data}`);
    socket.emit('chat:left', { requestId: parsed.data });
  });

  const emitTyping = (event: 'chat:typing' | 'chat:stop-typing', rawRequestId: unknown) => {
    const parsed = messageRequestIdSchema.safeParse(rawRequestId);
    if (!parsed.success || !socket.rooms.has(`chat:${parsed.data}`)) return;
    socket.to(`chat:${parsed.data}`).emit(event, { userId, requestId: parsed.data });
  };

  socket.on('chat:typing', rawRequestId => emitTyping('chat:typing', rawRequestId));
  socket.on('chat:stop-typing', rawRequestId => emitTyping('chat:stop-typing', rawRequestId));
}
