import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import type { WorkerAcceptanceAccess } from '@/types';
import { subscriptionApi } from './api';
import type { BackendSubscriptionResponse } from './types';
import { revenueCatService } from './revenueCatService';

export const workerProQueryKey = (userId?: string | null) => ['worker-pro-subscription', userId ?? 'anonymous'];
export const backendSubscriptionQueryKey = (userId?: string | null) => ['backend-subscription', userId ?? 'anonymous'];

export function updateCachedWorkerAccess(
  queryClient: QueryClient,
  userId: string | null | undefined,
  workerAccess: WorkerAcceptanceAccess,
) {
  queryClient.setQueryData<BackendSubscriptionResponse | undefined>(
    backendSubscriptionQueryKey(userId),
    current => current ? { ...current, workerAccess } : current,
  );
}

export function useRevenueCatIdentity(userId?: string | null) {
  useEffect(() => {
    if (userId) {
      void revenueCatService.configureForUser(userId);
      return;
    }

    void revenueCatService.clearUser();
  }, [userId]);
}

export function useWorkerProSubscription() {
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const userId = user?.id ?? null;

  const statusQuery = useQuery({
    queryKey: workerProQueryKey(userId),
    queryFn: () => revenueCatService.getWorkerProStatus(userId),
    enabled: Boolean(userId),
    retry: 1,
  });

  const backendQuery = useQuery({
    queryKey: backendSubscriptionQueryKey(userId),
    queryFn: subscriptionApi.me,
    enabled: Boolean(userId),
    retry: 1,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: workerProQueryKey(userId) });
    queryClient.invalidateQueries({ queryKey: backendSubscriptionQueryKey(userId) });
  }, [queryClient, userId]);

  const purchase = useMutation({
    mutationFn: () => revenueCatService.purchaseWorkerPro(userId, statusQuery.data?.packageToPurchase),
    onSuccess: refresh,
  });

  const restore = useMutation({
    mutationFn: () => revenueCatService.restorePurchases(userId),
    onSuccess: refresh,
  });

  return {
    statusQuery,
    backendQuery,
    purchase,
    restore,
    refresh,
  };
}
