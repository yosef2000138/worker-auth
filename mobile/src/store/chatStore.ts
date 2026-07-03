import { create } from 'zustand';
import { Message } from '@/types';

type State = {
  messagesByRequest: Record<string, Message[]>;
  unreadCount: number;
  setMessages: (requestId: string, messages: Message[]) => void;
  addMessage: (requestId: string, message: Message) => void;
  setUnreadCount: (count: number) => void;
  incrementUnreadCount: () => void;
  reset: () => void;
};

export const useChatStore = create<State>((set) => ({
  messagesByRequest: {},
  unreadCount: 0,
  setMessages: (requestId, messages) => set((s) => ({ messagesByRequest: { ...s.messagesByRequest, [requestId]: messages } })),
  addMessage: (requestId, message) => set((s) => {
    const current = s.messagesByRequest[requestId] ?? [];
    if (current.some(item => item.id === message.id)) return s;
    return { messagesByRequest: { ...s.messagesByRequest, [requestId]: [...current, message] } };
  }),
  setUnreadCount: (unreadCount) => set({ unreadCount: Math.max(0, unreadCount) }),
  incrementUnreadCount: () => set(s => ({ unreadCount: s.unreadCount + 1 })),
  reset: () => set({ messagesByRequest: {}, unreadCount: 0 }),
}));
