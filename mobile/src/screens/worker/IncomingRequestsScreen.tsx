import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { requestService } from '@/services/requestService';
import {
  BackendSubscriptionResponse,
  backendSubscriptionQueryKey,
  subscriptionApi,
  updateCachedWorkerAccess,
  workerProQueryKey,
} from '@/features/subscriptions';
import { Banner, Body, BodySm, Button, Card, EmptyState, ErrorState, H2, ListSkeleton, Row, Screen, Stack, StatusBadge } from '@/components/ui';
import { MapPreview } from '@/components/map';
import { Paginated, RootStackParamList, ServiceRequest, WorkerAcceptanceAccess } from '@/types';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';
import { formatAppDate, getLocalizedCategoryName, useLanguage } from '@/i18n';
import { localizedApiErrorMessage } from '@/utils/localizedErrors';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function getItems(data?: Paginated<ServiceRequest>) {
  return Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
}

function canAcceptFromAccess(access?: WorkerAcceptanceAccess) {
  if (!access) return true;
  const explicit = access.canAcceptRequest ?? access.canAcceptMoreRequests;
  if (typeof explicit === 'boolean') return explicit;
  const used = access.freeRequestsUsed ?? access.acceptedRequestCount;
  const limit = access.freeRequestLimit ?? access.freeAcceptedRequestLimit;
  const hasActiveSubscription = access.hasActiveSubscription ?? access.hasSubscriptionAccess;
  return used < limit || hasActiveSubscription;
}

function workerAccessFromError(error: unknown) {
  if (typeof error !== 'object' || error === null || !('details' in error)) return null;
  const details = (error as { details?: unknown }).details;
  if (typeof details !== 'object' || details === null || !('freeAcceptedRequestLimit' in details)) return null;
  return details as WorkerAcceptanceAccess;
}

export default function IncomingRequestsScreen() {
  const { t, locale, language, plural } = useLanguage();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning'; message: string } | null>(null);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['incoming'],
    queryFn: () => requestService.list({ status: 'PENDING', limit: 30 }),
  });
  const backendAccessQuery = useQuery({
    queryKey: backendSubscriptionQueryKey(user?.id),
    queryFn: subscriptionApi.me,
    enabled: Boolean(user?.id),
    retry: 1,
  });
  const accept = useMutation({
    mutationFn: (requestId: string) => {
      setAcceptingId(requestId);
      setNotice(null);
      return requestService.accept(requestId);
    },
    onSuccess: (result) => {
      const request = result.request;
      queryClient.invalidateQueries({ queryKey: ['incoming'] });
      queryClient.invalidateQueries({ queryKey: ['worker-requests'] });
      queryClient.setQueryData(['request', request.id], request);
      if (result.workerAccess) {
        updateCachedWorkerAccess(queryClient, user?.id, result.workerAccess);
        queryClient.invalidateQueries({ queryKey: backendSubscriptionQueryKey(user?.id) });
        queryClient.invalidateQueries({ queryKey: workerProQueryKey(user?.id) });
      }
      const remaining = result.workerAccess?.freeRequestsRemaining ?? result.workerAccess?.remainingFreeRequests;
      setNotice({
        tone: 'success',
        message: typeof remaining === 'number'
          ? `${t('worker.requests.accepted')} ${plural({
            zero: 'subscription.freeRequestsRemaining.zero',
            one: 'subscription.freeRequestsRemaining.one',
            two: 'subscription.freeRequestsRemaining.two',
            few: 'subscription.freeRequestsRemaining.few',
            many: 'subscription.freeRequestsRemaining.many',
            other: 'subscription.freeRequestsRemaining.other',
          }, remaining)}`
          : t('worker.requests.accepted'),
      });
      navigation.navigate('ActiveJob', { requestId: request.id });
    },
    onError: (error) => {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      if (code === 'WORKER_SUBSCRIPTION_REQUIRED' || code === 'WORKER_PRO_REQUIRED') {
        const workerAccess = workerAccessFromError(error);
        if (workerAccess) {
          updateCachedWorkerAccess(queryClient, user?.id, workerAccess);
        }
        queryClient.invalidateQueries({ queryKey: backendSubscriptionQueryKey(user?.id) });
        setNotice({ tone: 'warning', message: t('errors.workerProRequired') });
        navigation.navigate('Subscription');
      }
    },
    onSettled: () => setAcceptingId(null),
  });

  const latestWorkerAccess =
    queryClient.getQueryData<BackendSubscriptionResponse>(backendSubscriptionQueryKey(user?.id))?.workerAccess ??
    backendAccessQuery.data?.workerAccess;
  const items = getItems(data).filter(item => item.status === 'PENDING');
  const acceptError = accept.isError ? localizedApiErrorMessage(accept.error, t, 'errors.generic') : '';
  const openWorkerPro = () => {
    queryClient.invalidateQueries({ queryKey: backendSubscriptionQueryKey(user?.id) });
    queryClient.invalidateQueries({ queryKey: workerProQueryKey(user?.id) });
    setNotice({ tone: 'warning', message: t('errors.workerProRequired') });
    navigation.navigate('Subscription');
  };
  const handleAccept = (requestId: string) => {
    const cachedAccess =
      queryClient.getQueryData<BackendSubscriptionResponse>(backendSubscriptionQueryKey(user?.id))?.workerAccess ??
      latestWorkerAccess;

    if (cachedAccess && !canAcceptFromAccess(cachedAccess)) {
      openWorkerPro();
      return;
    }

    accept.mutate(requestId);
  };

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <H2>{t('worker.requests.title')}</H2>
        <BodySm color={colors.textSecondary}>{t('worker.requests.pendingNear', { count: items.length })}</BodySm>
        {notice ? <Banner tone={notice.tone} message={notice.message} /> : null}
        {accept.isError && acceptError ? <Banner tone="danger" message={acceptError} /> : null}
      </View>
      {isLoading ? (
        <View style={styles.list}><ListSkeleton count={4} /></View>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : items.length === 0 ? (
        <EmptyState icon="notifications-outline" title={t('worker.requests.emptyTitle')} message={t('worker.requests.emptyMessage')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <Card>
              <Stack gap={spacing.md}>
                <Row justify="space-between" align="flex-start">
                  <Stack gap={spacing.xs} style={{ flex: 1 }}>
                    <Body weight="bold">{item.title}</Body>
                    <BodySm color={colors.textSecondary}>{item.category ? getLocalizedCategoryName(item.category, language.code, t) : t('worker.requests.serviceRequest')}</BodySm>
                    {item.createdAt ? <BodySm color={colors.textTertiary}>{formatAppDate(item.createdAt, locale)}</BodySm> : null}
                  </Stack>
                  <StatusBadge status={item.status} />
                </Row>
                <BodySm color={colors.textSecondary}>{item.description}</BodySm>
                <MapPreview address={item.address} lat={item.lat} lng={item.lng} />
                <Row gap={spacing.sm} wrap>
                  <Button
                    title={t('common.details')}
                    variant="outline"
                    fullWidth={false}
                    style={styles.requestAction}
                    onPress={() => navigation.navigate('ActiveJob', { requestId: item.id })}
                  />
                  <Button
                    title={t('common.map')}
                    variant="outline"
                    fullWidth={false}
                    style={styles.requestAction}
                    onPress={() => navigation.navigate('Map', {
                      lat: item.lat,
                      lng: item.lng,
                      address: item.address,
                      title: item.title,
                      requestId: item.id,
                    })}
                  />
                  <Button
                    title={t('worker.requests.accept')}
                    fullWidth={false}
                    style={styles.requestAction}
                    loading={acceptingId === item.id}
                    disabled={accept.isPending && acceptingId !== item.id}
                    onPress={() => handleAccept(item.id)}
                  />
                </Row>
              </Stack>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, gap: spacing.xs },
  list: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  requestAction: { flexBasis: '31%', flexGrow: 1 },
});
