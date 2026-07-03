import { useCallback, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useNotificationStore } from '@/store/notificationStore';
import { Message, NotificationItem } from '@/types';

export function useSocket() {
  const token = useAuthStore((s) => s.accessToken);
  const userId = useAuthStore((s) => s.user?.id);
  const addMessage = useChatStore((s) => s.addMessage);
  const incrementUnreadCount = useChatStore((s) => s.incrementUnreadCount);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const socket = useMemo(
    () =>
      token
        ? io(SOCKET_URL, {
            auth: { token },
            autoConnect: true,
            forceNew: true,
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 10000,
            timeout: 20000,
            transports: ['websocket', 'polling'],
          })
        : null,
    [token],
  );

  useEffect(() => {
    if (!socket) return;

    const handleChatMessage = (payload: { requestId: string; message: Message }) => {
      const existingMessages = useChatStore.getState().messagesByRequest[payload.requestId] ?? [];
      const isDuplicate = existingMessages.some(item => item.id === payload.message.id);
      addMessage(payload.requestId, payload.message);

      const senderId = payload.message.senderId ?? payload.message.sender?.id;
      if (!isDuplicate && senderId && senderId !== userId) {
        incrementUnreadCount();
      }
    };
    const handleNotification = (n: NotificationItem) => addNotification(n);

    socket.on('chat:message', handleChatMessage);
    socket.on('notification:new', handleNotification);

    return () => {
      socket.off('chat:message', handleChatMessage);
      socket.off('notification:new', handleNotification);
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [socket, addMessage, addNotification, incrementUnreadCount, userId]);

  return socket;
}

export function useChatRoom(socket: Socket | null, requestId: string) {
  useEffect(() => {
    if (!socket) return;
    socket.emit('chat:join', requestId);
    return () => {
      socket.emit('chat:leave', requestId);
    };
  }, [socket, requestId]);

  const sendViaSocket = useCallback((content: string) => {
    socket?.emit('chat:message', { requestId, content });
  }, [socket, requestId]);

  return { sendViaSocket };
}
