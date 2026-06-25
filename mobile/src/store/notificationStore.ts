import { create } from 'zustand';
import { NotificationItem } from '@/types';
type State = { notifications: NotificationItem[]; unreadCount: number; setNotifications: (items: NotificationItem[]) => void; addNotification: (item: NotificationItem) => void; setUnreadCount: (count: number) => void };
export const useNotificationStore = create<State>((set) => ({ notifications: [], unreadCount: 0, setNotifications: (notifications) => set({ notifications }), addNotification: (item) => set((s) => ({ notifications: [item, ...s.notifications], unreadCount: s.unreadCount + 1 })), setUnreadCount: (unreadCount) => set({ unreadCount }) }));
