import { useCallback, useEffect, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { useChatStore } from '@/store/chatStore';
import { useNotificationStore } from '@/store/notificationStore';
import { Message, NotificationItem } from '@/types';

export function useSocket() {
  const token = useAuthStore((s) => s.accessToken);
  const addMessage = useChatStore((s) => s.addMessage);
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

    socket.on('chat:message', (payload: { requestId: string; message: Message }) => addMessage(payload.requestId, payload.message));
    socket.on('notification:new', (n: NotificationItem) => addNotification(n));

    return () => {
      socket.disconnect();
    };
  }, [socket, addMessage, addNotification]);

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
