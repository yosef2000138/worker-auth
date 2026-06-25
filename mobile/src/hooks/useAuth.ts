import { useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { authService, LoginPayload, RegisterPayload } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
export function useAuth() { const { user, setAuth, logoutLocal, setHydrated } = useAuthStore(); useEffect(() => { authService.refresh().then(setAuth).catch(() => setHydrated(true)); }, [setAuth, setHydrated]); const login = useMutation({ mutationFn: (p: LoginPayload) => authService.login(p), onSuccess: setAuth }); const register = useMutation({ mutationFn: (p: RegisterPayload) => authService.register(p) }); const logout = async () => { await authService.logout(); logoutLocal(); }; return { user, isAuthenticated: Boolean(user), login, register, logout }; }
