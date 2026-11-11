import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Paginated, RootStackParamList, ServiceRequest } from '@/types';
import { requestService } from '@/services/requestService';
import { workerService } from '@/services/workerService';
import { BackendSubscriptionResponse, backendSubscriptionQueryKey, getWorkerProPrice, subscriptionApi } from '@/features/subscriptions';
import { useAuthStore } from '@/store/authStore';
import { Avatar, Badge, Body, BodySm, Button, Card, EmptyState, ErrorState, H2, ListSkeleton, Row, Screen, SectionHeader, Stack, StatusBadge, StatusPill } from '@/components/ui';
import { formatAppDate, useLanguage } from '@/i18n';
import { colors, spacing } from '@/theme';
import type { TranslationKey } from '@/i18n';
import { queryKeys } from '@/utils/queryKeys';
type Props = NativeStackScreenProps<RootStackParamList, 'WorkerDashboard'>;

const ACTIVE_STATUSES = ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'] as const;

function getItems(data?: Paginated<ServiceRequest>) {
  return Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function SubscriptionSummaryCard({
  status,
  onPress,
  t,
  locale,
}: {
  status?: BackendSubscriptionResponse;
  onPress: () => void;
  t: (key: TranslationKey, values?: Record<string, string | number>) => string;
  locale: string;
}) {
  if (!status) return null;
  const access = status.workerAccess;
  const used = access?.freeRequestsUsed ?? access?.acceptedRequestCount ?? 0;
  const limit = access?.freeRequestLimit ?? access?.freeAcceptedRequestLimit ?? 0;
  const remaining = access?.freeRequestsRemaining ?? access?.remainingFreeRequests ?? 0;
  const monthlyPrice = t('subscription.price.monthly', {
    price: getWorkerProPrice(locale),
  });
  const exhausted = Boolean(access) && remaining <= 0 && !access?.hasActiveSubscription && !status.hasAccess;

  if (status.hasAccess) {
    return (
      <Card>
        <Stack gap={spacing.sm}>
          <Row justify="space-between">
            <Badge label={t('subscription.title')} tone="success" />
            <BodySm color={colors.textSecondary}>{status.platform ?? t('common.store')}</BodySm>
          </Row>
          <Body weight="bold">{t('worker.dashboard.proActive')}</Body>
          <BodySm color={colors.textSecondary}>
            {status.expirationDate
              ? status.willRenew
                ? t('worker.dashboard.renewsOn', { date: formatAppDate(status.expirationDate, locale) })
                : t('worker.dashboard.endsOn', { date: formatAppDate(status.expirationDate, locale) })
              : t('worker.dashboard.billingStore')}
          </BodySm>
          {access ? (
            <BodySm color={colors.textSecondary}>
              {t('subscription.freeUsageSummary', { used, limit, remaining })}
            </BodySm>
          ) : null}
          <Button title={t('worker.dashboard.viewPro')} variant="outline" size="sm" onPress={onPress} />
        </Stack>
      </Card>
    );
  }

  return (
    <Card style={exhausted ? styles.proLimitCard : undefined}>
      <Stack gap={spacing.sm}>
        <Row justify="space-between">
          <Badge label={t('subscription.title')} tone={status.enabled ? 'brand' : 'neutral'} />
          <BodySm color={colors.textSecondary}>{monthlyPrice}</BodySm>
        </Row>
          <Body weight="bold">
          {exhausted
            ? t('worker.dashboard.freeLimitReached')
            : status.enabled
            ? t('worker.dashboard.proAvailable')
            : t('subscription.betaAccessActive')}
        </Body>
        <BodySm color={colors.textSecondary}>
          {exhausted
            ? t('worker.dashboard.subscribeToContinue')
            : access
            ? t('subscription.freeUsageSummary', { used, limit, remaining })
            : t('subscription.betaAccessMessage')}
        </BodySm>
        {exhausted ? <BodySm weight="bold">{monthlyPrice}</BodySm> : null}
        <Button title={t('worker.dashboard.viewPro')} variant="outline" size="sm" onPress={onPress} />
      </Stack>
    </Card>
  );
}

export default function DashboardScreen({ navigation }: Props) {
  const { t, locale } = useLanguage();
  const user = useAuthStore(s => s.user);
  const workerQuery = useQuery({
    queryKey: queryKeys.workerMe(user?.id),
    queryFn: workerService.me,
    enabled: Boolean(user?.id),
    retry: 1,
  });
  const requestsQuery = useQuery({
    queryKey: queryKeys.workerRequests(user?.id),
    queryFn: () => requestService.list({ limit: 30 }),
    enabled: Boolean(user?.id),
    retry: 1,
  });
  const subscriptionQuery = useQuery({
    queryKey: backendSubscriptionQueryKey(user?.id),
    queryFn: subscriptionApi.me,
    enabled: Boolean(user?.id),
    retry: 1,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
  });
  const refetchSubscription = subscriptionQuery.refetch;
  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) {
        workerQuery.refetch();
        requestsQuery.refetch();
      }
      refetchSubscription();
    }, [refetchSubscription, requestsQuery, user?.id, workerQuery]),
  );
  const items = getItems(requestsQuery.data);
  const active = items.filter(item => ACTIVE_STATUSES.includes(item.status as (typeof ACTIVE_STATUSES)[number]));
  const pending = items.filter(item => item.status === 'PENDING');
  const visible = [...active, ...pending].slice(0, 5);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Row gap={spacing.md}>
          <Avatar uri={workerQuery.data?.user?.avatarUrl} name={workerQuery.data?.user?.fullName} size={52} />
          <Stack gap={spacing.xs} style={{ flex: 1 }}>
            <H2>{workerQuery.data?.user?.fullName ?? t('common.workerRole')}</H2>
            <StatusPill
              label={workerQuery.data?.isAvailable ? t('worker.dashboard.available') : t('worker.dashboard.unavailable')}
              tone={workerQuery.data?.isAvailable ? 'success' : 'neutral'}
              icon={workerQuery.data?.isAvailable ? 'radio-button-on-outline' : 'pause-circle-outline'}
            />
          </Stack>
        </Row>
        <Row gap={spacing.sm} wrap>
          <Button title={t('worker.dashboard.incomingCount', { count: pending.length })} fullWidth={false} style={styles.quickAction} onPress={() => navigation.navigate('IncomingRequests')} />
          <Button title={t('nav.workCalendar')} variant="outline" fullWidth={false} style={styles.quickAction} onPress={() => navigation.navigate('Availability')} />
          <Button title={t('common.map')} variant="outline" fullWidth={false} style={styles.quickAction} onPress={() => navigation.navigate('Map')} />
        </Row>
        {subscriptionQuery.isLoading ? (
          <Card>
            <BodySm color={colors.textSecondary}>{t('subscription.loadingAccess')}</BodySm>
          </Card>
        ) : subscriptionQuery.isError ? (
          <Card>
            <Stack gap={spacing.sm}>
              <BodySm color={colors.textSecondary}>{t('subscription.serverAccessUnavailable')}</BodySm>
              <Button title={t('common.retry')} variant="outline" size="sm" onPress={() => subscriptionQuery.refetch()} />
            </Stack>
          </Card>
        ) : (
          <SubscriptionSummaryCard status={subscriptionQuery.data} t={t} locale={locale} onPress={() => navigation.navigate('Subscription')} />
        )}
      </View>

      {workerQuery.isLoading || requestsQuery.isLoading ? (
        <View style={styles.list}><ListSkeleton count={4} /></View>
      ) : workerQuery.isError || requestsQuery.isError ? (
        <ErrorState
          message={errorMessage(workerQuery.error ?? requestsQuery.error, t('worker.dashboard.loadError'))}
          onRetry={() => {
            workerQuery.refetch();
            requestsQuery.refetch();
          }}
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="briefcase-outline"
          title={t('worker.dashboard.noJobsTitle')}
          message={t('worker.dashboard.noJobsMessage')}
          actionLabel={t('worker.dashboard.checkIncoming')}
          onAction={() => navigation.navigate('IncomingRequests')}
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <SectionHeader
              title={t('worker.dashboard.nextJobs')}
              subtitle={t('worker.dashboard.nextJobsHint')}
            />
          }
          ListHeaderComponentStyle={styles.listHeader}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('ActiveJob', { requestId: item.id })}>
              <Card>
                <Row justify="space-between" align="flex-start">
                  <Stack gap={spacing.xs} style={{ flex: 1 }}>
                    <Body weight="bold">{item.title}</Body>
                    <BodySm color={colors.textSecondary}>{item.address ?? t('requests.location.notProvided')}</BodySm>
                    {item.createdAt ? <BodySm color={colors.textTertiary}>{formatAppDate(item.createdAt, locale)}</BodySm> : null}
                  </Stack>
                  <StatusBadge status={item.status} />
                </Row>
              </Card>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, gap: spacing.md },
  list: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  listHeader: { marginBottom: spacing.md },
  quickAction: { flexBasis: '31%', flexGrow: 1 },
  proLimitCard: { borderColor: colors.warning, backgroundColor: colors.warningSoft },
});
