import { useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authService, LoginPayload, RegisterPayload } from '@/services/authService';
import { useChatStore } from '@/store/chatStore';
import { useAuthStore } from '@/store/authStore';
import { useNotificationStore } from '@/store/notificationStore';

let authHydrationStarted = false;

export function useAuth() {
  const { user, hydrated, setAuth, logoutLocal, setHydrated } = useAuthStore();
  const queryClient = useQueryClient();

  const resetSessionState = async () => {
    await queryClient.cancelQueries();
    useChatStore.getState().reset();
    useNotificationStore.getState().reset();
    queryClient.clear();
  };

  useEffect(() => {
    if (hydrated || authHydrationStarted) return;

    authHydrationStarted = true;
    authService.refresh().then(setAuth).catch(() => setHydrated(true));
  }, [hydrated, setAuth, setHydrated]);

  const login = useMutation({
    mutationFn: (p: LoginPayload) => authService.login(p),
    onSuccess: async (auth) => {
      await resetSessionState();
      setAuth(auth);
    },
  });
  const register = useMutation({ mutationFn: (p: RegisterPayload) => authService.register(p) });
  const logout = async () => {
    await queryClient.cancelQueries();
    try {
      await authService.logout();
    } finally {
      useChatStore.getState().reset();
      useNotificationStore.getState().reset();
      queryClient.clear();
      logoutLocal();
    }
  };

  return { user, isAuthenticated: Boolean(user), login, register, logout };
}
