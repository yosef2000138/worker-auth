import React from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';

import {
  BackendSubscriptionResponse,
  getWorkerProPrice,
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

function statusBadge(status: WorkerProStatus | undefined, t: (key: TranslationKey) => string, backendActive: boolean) {
  if (!status || status.status === 'LOADING') return { label: t('subscription.badge.loading'), tone: 'neutral' as const };
  if (backendActive) return { label: t('subscription.badge.active'), tone: 'success' as const };
  if (status.status === 'NOT_CONFIGURED') return { label: t('subscription.badge.notConfigured'), tone: 'neutral' as const };
  if (status.status === 'AVAILABLE') return { label: t('subscription.badge.available'), tone: 'brand' as const };
  if (status.status === 'UNAVAILABLE') return { label: t('subscription.badge.unavailable'), tone: 'neutral' as const };
  return { label: t('subscription.badge.error'), tone: 'danger' as const };
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
  const [verificationState, setVerificationState] = React.useState<'idle' | 'verifying' | 'delayed'>('idle');

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const status = statusQuery.data;
  const workerAccess = backendQuery.data?.workerAccess;
  const backendActive = Boolean(backendQuery.data?.hasAccess || workerAccess?.hasActiveSubscription);
  const badge = statusBadge(status, t, backendActive);
  const plannedMonthlyPrice = t('subscription.price.monthly', {
    price: getWorkerProPrice(locale),
  });
  const monthlyPrice = t('subscription.price.monthly', {
    price: getWorkerProPrice(locale, status?.localizedPrice),
  });
  const displayPrice = status?.localizedPrice
    ? monthlyPrice
    : plannedMonthlyPrice;
  const usedFreeRequests = workerAccess?.freeRequestsUsed ?? workerAccess?.acceptedRequestCount ?? 0;
  const freeRequestLimit = workerAccess?.freeRequestLimit ?? workerAccess?.freeAcceptedRequestLimit ?? 0;
  const remainingFreeRequests = workerAccess?.freeRequestsRemaining ?? workerAccess?.remainingFreeRequests ?? 0;
  const canAcceptRequest = workerAccess?.canAcceptRequest ?? workerAccess?.canAcceptMoreRequests ?? false;
  const canSubscribe = status?.status === 'AVAILABLE' && Boolean(status.packageToPurchase) && !status.hasAccess;
  const canRestore = Boolean(status?.configured);
  const backendStatus = backendQuery.data?.status;
  const needsPaymentUpdate = backendStatus === 'BILLING_ISSUE';
  const cancelledOrExpired = backendStatus === 'CANCELLED' || backendStatus === 'EXPIRED' || backendStatus === 'REFUNDED';
  const canOpenManagement = Boolean(status?.managementURL && (backendActive || needsPaymentUpdate));
  const busy = purchase.isPending || restore.isPending || statusQuery.isFetching || verificationState === 'verifying';
  const serverStatusLabel = getSubscriptionStatusLabel(backendQuery.data?.status ?? status?.status, t);
  const primaryTitle = canOpenManagement
    ? needsPaymentUpdate
      ? t('subscription.updatePaymentMethod')
      : t('subscription.manage')
    : verificationState === 'verifying'
    ? t('subscription.verifying')
    : verificationState === 'delayed'
    ? t('subscription.retryVerification')
    : purchase.isError || needsPaymentUpdate
    ? t('subscription.retryPayment')
    : cancelledOrExpired
    ? t('subscription.reactivate')
    : backendActive
    ? t('subscription.activeButton')
    : t('subscription.subscribeForPrice', { price: monthlyPrice });
  const primaryDisabled = busy || (
    verificationState !== 'delayed' &&
    !canOpenManagement &&
    !canSubscribe
  );

  React.useEffect(() => {
    if (backendActive) setVerificationState('idle');
  }, [backendActive]);

  const verifyBackendAccess = React.useCallback(async () => {
    setVerificationState('verifying');
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const result = await backendQuery.refetch();
      const access = result.data?.workerAccess;
      if (result.data?.hasAccess || access?.hasActiveSubscription) {
        setVerificationState('idle');
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 1800));
    }
    setVerificationState('delayed');
  }, [backendQuery]);

  const handlePrimaryAction = () => {
    if (verificationState === 'delayed') {
      void verifyBackendAccess();
      return;
    }
    if (canOpenManagement && status?.managementURL) {
      Linking.openURL(status.managementURL).catch(() => {});
      return;
    }
    purchase.mutate(undefined, {
      onSuccess: result => {
        if (!result.cancelled) void verifyBackendAccess();
      },
    });
  };

  const handleRestore = () => {
    restore.mutate(undefined, {
      onSuccess: result => {
        if (!result.cancelled) void verifyBackendAccess();
      },
    });
  };

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
            <Body>{t('subscription.planDescription')}</Body>
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
      {verificationState === 'verifying' ? <Banner tone="warning" message={t('subscription.verifyingMessage')} /> : null}
      {verificationState === 'delayed' ? <Banner tone="warning" message={t('subscription.verificationDelayed')} /> : null}
      {backendActive && canAcceptRequest ? <Banner tone="success" message={t('subscription.activeSuccess')} /> : null}

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
            <BodySm color={colors.textSecondary}>{t('subscription.backendStatus')}</BodySm>
            <BodySm weight="bold">{serverStatusLabel}</BodySm>
          </Row>
          <Row justify="space-between">
            <BodySm color={colors.textSecondary}>{t('subscription.access')}</BodySm>
            <BodySm weight="bold">{backendActive ? t('common.active') : t('common.inactive')}</BodySm>
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
                <BodySm color={colors.textSecondary}>{t('subscription.freeUsed')}</BodySm>
                <BodySm weight="bold">{t('subscription.freeUsedValue', { used: usedFreeRequests, limit: freeRequestLimit })}</BodySm>
              </Row>
              <Row justify="space-between">
                <BodySm color={colors.textSecondary}>{t('subscription.freeRemaining')}</BodySm>
                <BodySm weight="bold">{remainingFreeRequests}</BodySm>
              </Row>
              <Row justify="space-between">
                <BodySm color={colors.textSecondary}>{t('subscription.nextAcceptance')}</BodySm>
                <BodySm weight="bold">{canAcceptRequest ? t('common.allowed') : t('subscription.workerProRequired')}</BodySm>
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
          <BodySm color={colors.textSecondary}>
            {t('subscription.recurringDisclosure', { price: monthlyPrice })}
          </BodySm>
          <Button
            title={primaryTitle}
            loading={purchase.isPending}
            disabled={primaryDisabled}
            onPress={handlePrimaryAction}
          />
          <Button
            title={t('subscription.restore')}
            variant="outline"
            loading={restore.isPending}
            disabled={!canRestore || busy}
            onPress={handleRestore}
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
