import { create } from 'zustand';
import { Message } from '@/types';
type State = { messagesByRequest: Record<string, Message[]>; setMessages: (requestId: string, messages: Message[]) => void; addMessage: (requestId: string, message: Message) => void };
export const useChatStore = create<State>((set) => ({ messagesByRequest: {}, setMessages: (requestId, messages) => set((s) => ({ messagesByRequest: { ...s.messagesByRequest, [requestId]: messages } })), addMessage: (requestId, message) => set((s) => {
  const current = s.messagesByRequest[requestId] ?? [];
  if (current.some(item => item.id === message.id)) return s;
  return { messagesByRequest: { ...s.messagesByRequest, [requestId]: [...current, message] } };
}) }));
