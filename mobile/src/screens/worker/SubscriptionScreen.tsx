import React from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import {
  BackendSubscriptionResponse,
  SUBSCRIPTION_CONFIG,
  useWorkerProSubscription,
  WorkerProStatus,
} from '@/features/subscriptions';
import { Badge, Banner, Body, BodySm, Button, Card, ErrorState, H2, H3, ListSkeleton, Row, Stack } from '@/components/ui';
import { formatAppDate, getSubscriptionStatusLabel, useLanguage } from '@/i18n';
import { colors, spacing } from '@/theme';
import type { TranslationKey } from '@/i18n';

function backendCopy(status: BackendSubscriptionResponse | undefined, t: (key: TranslationKey, values?: Record<string, string | number>) => string) {
  if (!status) return t('subscription.message.backendUnavailable');
  if (!status.configured) return t('subscription.message.backendNotConfigured');
  if (!status.enabled) return t('subscription.message.backendDisabled');
  if (status.hasAccess) return t('subscription.message.backendVerified');
  return t('subscription.message.backendStatus', { status: getSubscriptionStatusLabel(status.status, t) });
}

function statusBadge(status: WorkerProStatus | undefined, t: (key: TranslationKey) => string) {
  if (!status || status.status === 'LOADING') return { label: t('subscription.badge.loading'), tone: 'neutral' as const };
  if (status.hasAccess) return { label: t('subscription.badge.active'), tone: 'success' as const };
  if (status.status === 'NOT_CONFIGURED') return { label: t('subscription.badge.notConfigured'), tone: 'neutral' as const };
  if (status.status === 'AVAILABLE') return { label: t('subscription.badge.available'), tone: 'brand' as const };
  if (status.status === 'UNAVAILABLE') return { label: t('subscription.badge.unavailable'), tone: 'neutral' as const };
  return { label: t('subscription.badge.error'), tone: 'danger' as const };
}

function normalizePriceForLocale(price: string, locale: string) {
  const cleaned = price.replace(/^Planned price:\s*/i, '').replace(/\/month$/i, '').trim();
  const shekelMatch = cleaned.match(/^₪\s?(.+)$/);
  if (shekelMatch && (locale === 'ar' || locale === 'he' || locale === 'ru')) {
    return `${shekelMatch[1]} ₪`;
  }
  return cleaned;
}

function localizedPurchaseMessage(message: string | undefined, t: (key: TranslationKey) => string) {
  if (!message) return '';
  const lower = message.toLowerCase();
  if (lower.includes('expo go') || lower.includes('development build')) return t('subscription.message.nativeBuildRequired');
  if (lower.includes('ios') && lower.includes('android')) return t('subscription.message.platformUnavailable');
  if (lower.includes('not configured')) return t('subscription.message.notConfigured');
  if (lower.includes('offering') || lower.includes('package was not found')) return t('subscription.message.offeringMissing');
  if (lower.includes('package is not available')) return t('subscription.message.packageUnavailable');
  if (lower.includes('cancel')) return t('subscription.message.purchaseCancelled');
  if (lower.includes('pending')) return t('subscription.message.purchasePending');
  if (lower.includes('network') || lower.includes('connection')) return t('subscription.message.purchaseNetwork');
  if (lower.includes('credential') || lower.includes('configuration')) return t('subscription.message.purchaseConfig');
  if (lower.includes('unsupported')) return t('subscription.message.purchaseUnsupported');
  return t('subscription.message.purchaseFailed');
}

export default function SubscriptionScreen() {
  const { t, locale } = useLanguage();
  const { statusQuery, backendQuery, purchase, restore, refresh } = useWorkerProSubscription();

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const status = statusQuery.data;
  const workerAccess = backendQuery.data?.workerAccess;
  const badge = statusBadge(status, t);
  const plannedMonthlyPrice = t('subscription.price.monthly', {
    price: normalizePriceForLocale(SUBSCRIPTION_CONFIG.plannedPriceLabel, locale),
  });
  const displayPrice = status?.localizedPrice
    ? t('subscription.price.monthly', { price: normalizePriceForLocale(status.localizedPrice, locale) })
    : t('subscription.price.planned', { price: plannedMonthlyPrice });
  const canSubscribe = status?.status === 'AVAILABLE' && Boolean(status.packageToPurchase) && !status.hasAccess;
  const canRestore = Boolean(status?.configured);
  const busy = purchase.isPending || restore.isPending || statusQuery.isFetching;

  if (statusQuery.isLoading) {
    return <ScrollView style={styles.root} contentContainerStyle={styles.content}><ListSkeleton count={4} /></ScrollView>;
  }

  if (statusQuery.isError) {
    return <ErrorState message={t('subscription.message.backendUnavailable')} onRetry={statusQuery.refetch} />;
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Card style={styles.heroCard}>
        <Row justify="space-between" align="flex-start">
          <Stack gap={spacing.sm} style={{ flex: 1 }}>
            <Badge label={badge.label} tone={badge.tone} />
            <H2>{t('subscription.title')}</H2>
            <Body weight="bold">{displayPrice}</Body>
            <BodySm color={colors.textSecondary}>
              {status?.localizedPrice
                ? t('subscription.price.storeLocalized')
                : t('subscription.price.plannedUnavailable')}
            </BodySm>
          </Stack>
          <View style={styles.iconWrap}>
            <Ionicons name="shield-checkmark-outline" size={34} color={colors.brand} />
          </View>
        </Row>
      </Card>

      {status?.message ? <Banner tone={status.status === 'ERROR' ? 'danger' : 'warning'} message={localizedPurchaseMessage(status.message, t)} /> : null}
      {purchase.isError ? <Banner tone="danger" message={localizedPurchaseMessage(purchase.error.message, t)} /> : null}
      {restore.isError ? <Banner tone="danger" message={localizedPurchaseMessage(restore.error.message, t)} /> : null}
      {purchase.data ? (
        <Banner
          tone={purchase.data.cancelled ? 'warning' : purchase.data.hasAccess ? 'success' : 'warning'}
          message={purchase.data.cancelled ? t('subscription.message.purchaseCancelled') : purchase.data.hasAccess ? t('subscription.message.purchaseActive') : t('subscription.message.purchaseWaiting')}
        />
      ) : null}
      {restore.data ? <Banner tone={restore.data.hasAccess ? 'success' : 'warning'} message={restore.data.hasAccess ? t('subscription.message.restored') : t('subscription.message.restoreNone')} /> : null}

      <Card>
        <Stack gap={spacing.md}>
          <H3>{t('subscription.included')}</H3>
          <Benefit text={t('subscription.benefit.visibility')} />
          <Benefit text={t('subscription.benefit.insights')} />
          <Benefit text={t('subscription.benefit.billing')} />
          <Benefit text={t('subscription.benefit.restore')} />
        </Stack>
      </Card>

      <Card>
        <Stack gap={spacing.md}>
          <H3>{t('subscription.currentStatus')}</H3>
          <Row justify="space-between">
            <BodySm color={colors.textSecondary}>{t('subscription.provider')}</BodySm>
            <BodySm weight="bold">{status?.status ?? t('common.unknown')}</BodySm>
          </Row>
          <Row justify="space-between">
            <BodySm color={colors.textSecondary}>{t('subscription.access')}</BodySm>
            <BodySm weight="bold">{status?.hasAccess ? t('common.active') : t('common.inactive')}</BodySm>
          </Row>
          {status?.expirationDate ? (
            <Row justify="space-between">
              <BodySm color={colors.textSecondary}>{status.willRenew ? t('subscription.renews') : t('subscription.expires')}</BodySm>
              <BodySm weight="bold">{formatAppDate(status.expirationDate, locale)}</BodySm>
            </Row>
          ) : null}
          <BodySm color={colors.textSecondary}>{backendCopy(backendQuery.data, t)}</BodySm>
        </Stack>
      </Card>

      <Card>
        <Stack gap={spacing.md}>
          <H3>{t('subscription.acceptedAccess')}</H3>
          {backendQuery.isLoading ? (
            <BodySm color={colors.textSecondary}>{t('subscription.loadingAccess')}</BodySm>
          ) : workerAccess ? (
            <>
              <Row justify="space-between">
                <BodySm color={colors.textSecondary}>{t('subscription.acceptedRequests')}</BodySm>
                <BodySm weight="bold">{workerAccess.acceptedRequestCount}</BodySm>
              </Row>
              <Row justify="space-between">
                <BodySm color={colors.textSecondary}>{t('subscription.freeRemaining')}</BodySm>
                <BodySm weight="bold">{workerAccess.remainingFreeRequests} / {workerAccess.freeAcceptedRequestLimit}</BodySm>
              </Row>
              <Row justify="space-between">
                <BodySm color={colors.textSecondary}>{t('subscription.nextAcceptance')}</BodySm>
                <BodySm weight="bold">{workerAccess.canAcceptMoreRequests ? t('common.allowed') : t('subscription.workerProRequired')}</BodySm>
              </Row>
            </>
          ) : (
            <BodySm color={colors.textSecondary}>{t('subscription.serverAccessUnavailable')}</BodySm>
          )}
        </Stack>
      </Card>

      <Card>
        <Stack gap={spacing.md}>
          <H3>{t('common.actions')}</H3>
          <Button
            title={status?.hasAccess ? t('subscription.activeButton') : t('subscription.subscribe')}
            loading={purchase.isPending}
            disabled={!canSubscribe || busy}
            onPress={() => purchase.mutate()}
          />
          <Button
            title={t('subscription.restore')}
            variant="outline"
            loading={restore.isPending}
            disabled={!canRestore || busy}
            onPress={() => restore.mutate()}
          />
          {status?.managementURL ? (
            <Button
              title={t('subscription.manage')}
              variant="outline"
              disabled={busy}
              onPress={() => Linking.openURL(status.managementURL!)}
            />
          ) : null}
          {!status?.configured ? (
            <BodySm color={colors.textSecondary}>
              {t('subscription.devBuildHelp')}
            </BodySm>
          ) : null}
        </Stack>
      </Card>
    </ScrollView>
  );
}

function Benefit({ text }: { text: string }) {
  return (
    <Row gap={spacing.sm} align="flex-start">
      <Ionicons name="checkmark-circle" size={18} color={colors.success} />
      <BodySm style={{ flex: 1 }}>{text}</BodySm>
    </Row>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['4xl'] },
  heroCard: { borderColor: colors.brand },
  iconWrap: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.brandSoftest, alignItems: 'center', justifyContent: 'center' },
});
