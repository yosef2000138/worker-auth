import { create } from 'zustand';
import { AuthResult, User } from '@/types';
type AuthState = { user: User | null; accessToken: string | null; hydrated: boolean; setAuth: (auth: AuthResult) => void; setUser: (user: User | null) => void; logoutLocal: () => void; setHydrated: (hydrated: boolean) => void };
export const useAuthStore = create<AuthState>((set) => ({ user: null, accessToken: null, hydrated: false, setAuth: (auth) => set({ user: auth.user, accessToken: auth.accessToken, hydrated: true }), setUser: (user) => set({ user }), logoutLocal: () => set({ user: null, accessToken: null, hydrated: true }), setHydrated: (hydrated) => set({ hydrated }) }));
