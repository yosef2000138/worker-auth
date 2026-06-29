import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Paginated, RootStackParamList, ServiceRequest } from '@/types';
import { requestService } from '@/services/requestService';
import { workerService } from '@/services/workerService';
import { BackendSubscriptionResponse, subscriptionApi, SUBSCRIPTION_CONFIG } from '@/features/subscriptions';
import { Avatar, Badge, Body, BodySm, Button, Card, EmptyState, ErrorState, H2, ListSkeleton, Row, Screen, Stack, StatusBadge } from '@/components/ui';
import { formatAppDate, useLanguage } from '@/i18n';
import { colors, spacing } from '@/theme';
import type { TranslationKey } from '@/i18n';
type Props = NativeStackScreenProps<RootStackParamList, 'WorkerDashboard'>;

const ACTIVE_STATUSES = ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'] as const;

function getItems(data?: Paginated<ServiceRequest>) {
  return Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
}

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function normalizePriceForLocale(price: string, locale: string) {
  const cleaned = price.replace(/^Planned price:\s*/i, '').replace(/\/month$/i, '').trim();
  const shekelMatch = cleaned.match(/^₪\s?(.+)$/);
  if (shekelMatch && (locale === 'ar' || locale === 'he' || locale === 'ru')) return `${shekelMatch[1]} ₪`;
  return cleaned;
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
  const plannedMonthlyPrice = t('subscription.price.monthly', {
    price: normalizePriceForLocale(SUBSCRIPTION_CONFIG.plannedPriceLabel, locale),
  });

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
          <Button title={t('worker.dashboard.viewPro')} variant="outline" size="sm" onPress={onPress} />
        </Stack>
      </Card>
    );
  }

  return (
    <Card>
      <Stack gap={spacing.sm}>
        <Row justify="space-between">
          <Badge label={t('subscription.title')} tone={status.enabled ? 'brand' : 'neutral'} />
          <BodySm color={colors.textSecondary}>{t('subscription.price.planned', { price: plannedMonthlyPrice })}</BodySm>
        </Row>
        <Body weight="bold">{status.enabled ? t('worker.dashboard.proAvailable') : t('worker.dashboard.proNotConfigured')}</Body>
        <BodySm color={colors.textSecondary}>{t('worker.dashboard.normalAvailable')}</BodySm>
        <Button title={t('worker.dashboard.viewPro')} variant="outline" size="sm" onPress={onPress} />
      </Stack>
    </Card>
  );
}

export default function DashboardScreen({ navigation }: Props) {
  const { t, locale } = useLanguage();
  const workerQuery = useQuery({ queryKey: ['worker-me'], queryFn: workerService.me, retry: 1 });
  const requestsQuery = useQuery({ queryKey: ['worker-requests'], queryFn: () => requestService.list({ limit: 30 }), retry: 1 });
  const subscriptionQuery = useQuery({ queryKey: ['backend-subscription'], queryFn: subscriptionApi.me, retry: 1 });
  const refetchSubscription = subscriptionQuery.refetch;
  useFocusEffect(
    React.useCallback(() => {
      refetchSubscription();
    }, [refetchSubscription]),
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
            <BodySm color={colors.textSecondary}>
              {workerQuery.data?.isAvailable ? t('worker.dashboard.available') : t('worker.dashboard.unavailable')}
            </BodySm>
          </Stack>
        </Row>
        <Row gap={spacing.sm} wrap>
          <Button title={t('worker.dashboard.incomingCount', { count: pending.length })} fullWidth={false} style={styles.quickAction} onPress={() => navigation.navigate('IncomingRequests')} />
          <Button title={t('nav.workCalendar')} variant="outline" fullWidth={false} style={styles.quickAction} onPress={() => navigation.navigate('Availability')} />
          <Button title={t('common.map')} variant="outline" fullWidth={false} style={styles.quickAction} onPress={() => navigation.navigate('Map')} />
        </Row>
        <SubscriptionSummaryCard status={subscriptionQuery.data} t={t} locale={locale} onPress={() => navigation.navigate('Subscription')} />
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
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('ActiveJob', { requestId: item.id })}>
              <Card>
                <Row justify="space-between" align="flex-start">
                  <Stack gap={spacing.xs} style={{ flex: 1 }}>
                    <Body weight="bold">{item.title}</Body>
                    <BodySm color={colors.textSecondary}>{item.address}</BodySm>
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
  quickAction: { flexBasis: '31%', flexGrow: 1 },
});
