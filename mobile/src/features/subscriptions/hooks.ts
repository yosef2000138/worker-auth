import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/authStore';
import { subscriptionApi } from './api';
import { revenueCatService } from './revenueCatService';

const workerProQueryKey = (userId?: string | null) => ['worker-pro-subscription', userId ?? 'anonymous'];

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
    queryKey: ['backend-subscription', userId ?? 'anonymous'],
    queryFn: subscriptionApi.me,
    enabled: Boolean(userId),
    retry: 1,
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: workerProQueryKey(userId) });
    queryClient.invalidateQueries({ queryKey: ['backend-subscription', userId ?? 'anonymous'] });
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
