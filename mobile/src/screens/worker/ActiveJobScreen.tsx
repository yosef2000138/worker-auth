import React from 'react';
import { Alert, AppState, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Paginated, RequestStatus, RootStackParamList, ServiceRequest } from '@/types';
import { requestService, RequestStatusUpdate } from '@/services/requestService';
import {
  JobDescriptionCard,
  JobLoadingSkeleton,
  JobLocationCard,
  JobPaymentCard,
  JobProgressTimeline,
  JobScreenHeader,
  JobSummaryCard,
  JobTerminalStateCard,
  PersonSummaryCard,
  openExternalNavigation,
  openPhone,
} from '@/components/job';
import { Banner, BodySm, Button, Card, EmptyState, H3, Row, Stack } from '@/components/ui';
import { useLanguage } from '@/i18n';
import { colors, spacing } from '@/theme';
import type { TranslationKey } from '@/i18n';

type Props = NativeStackScreenProps<RootStackParamList, 'ActiveJob'>;

const ACTIVE_STATUSES = ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'] as const;

const NEXT_STATUS: Partial<Record<RequestStatus, RequestStatusUpdate>> = {
  ACCEPTED: 'ON_THE_WAY',
  ON_THE_WAY: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
};

const ACTION_LABEL_KEY: Partial<Record<RequestStatus, TranslationKey>> = {
  ACCEPTED: 'jobs.actions.heading',
  ON_THE_WAY: 'jobs.actions.start',
  IN_PROGRESS: 'jobs.actions.complete',
};

function getItems(data?: Paginated<ServiceRequest>) {
  return Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
}

function successCopy(status: RequestStatusUpdate, t: (key: TranslationKey) => string) {
  if (status === 'ACCEPTED') return t('jobs.success.accepted');
  if (status === 'ON_THE_WAY') return t('jobs.success.onTheWay');
  if (status === 'IN_PROGRESS') return t('jobs.success.inProgress');
  if (status === 'COMPLETED') return t('jobs.success.completed');
  return t('jobs.success.updated');
}

export default function ActiveJobScreen({ route, navigation }: Props) {
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const requestId = route.params?.requestId;
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['worker-active-fallback'],
    queryFn: () => requestService.list({ limit: 50 }),
    enabled: !requestId,
  });

  const fallbackItems = getItems(listQuery.data);
  const fallbackRequest = fallbackItems.find(item => ACTIVE_STATUSES.includes(item.status as (typeof ACTIVE_STATUSES)[number]));
  const effectiveId = requestId ?? fallbackRequest?.id;

  const requestQuery = useQuery({
    queryKey: ['request', effectiveId],
    queryFn: () => requestService.getOne(effectiveId!),
    enabled: Boolean(effectiveId),
  });

  const refetchRequest = requestQuery.refetch;

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active' && effectiveId) {
        void refetchRequest();
      }
    });

    return () => subscription.remove();
  }, [effectiveId, refetchRequest]);

  const advance = useMutation({
    mutationFn: (status: RequestStatusUpdate) => requestService.updateStatus(effectiveId!, status),
    onSuccess: (updated, status) => {
      setSuccessMessage(successCopy(status, t));
      queryClient.setQueryData(['request', effectiveId], updated);
      queryClient.invalidateQueries({ queryKey: ['request', effectiveId] });
      queryClient.invalidateQueries({ queryKey: ['worker-requests'] });
      queryClient.invalidateQueries({ queryKey: ['incoming'] });
    },
  });

  const cancel = useMutation({
    mutationFn: () => requestService.cancel(effectiveId!, 'Cancelled by worker'),
    onSuccess: (updated) => {
      setSuccessMessage(t('jobs.success.cancelled'));
      queryClient.setQueryData(['request', effectiveId], updated);
      queryClient.invalidateQueries({ queryKey: ['request', effectiveId] });
      queryClient.invalidateQueries({ queryKey: ['worker-requests'] });
    },
  });

  const refresh = React.useCallback(() => {
    setSuccessMessage(null);
    if (effectiveId) {
      void requestQuery.refetch();
    } else {
      void listQuery.refetch();
    }
  }, [effectiveId, listQuery, requestQuery]);

  const loading = listQuery.isLoading || requestQuery.isLoading;
  const refreshing = listQuery.isRefetching || requestQuery.isRefetching;

  if (loading) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <JobLoadingSkeleton />
      </ScrollView>
    );
  }

  if (!effectiveId) {
    return (
      <EmptyState
        icon="briefcase-outline"
        title={t('jobs.active.emptyTitle')}
        message={t('jobs.active.emptyMessage')}
        actionLabel={t('worker.dashboard.checkIncoming')}
        onAction={() => navigation.navigate('IncomingRequests')}
      />
    );
  }

  if (requestQuery.isError || !requestQuery.data) {
    return (
      <View style={styles.stateWrap}>
        <EmptyState
          icon="warning-outline"
          title={t('jobs.details.loadErrorTitle')}
          message={t('errors.tryAgain')}
          actionLabel={t('common.retry')}
          onAction={() => requestQuery.refetch()}
        />
        <Button title={t('common.back')} variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const request = requestQuery.data;
  const next = NEXT_STATUS[request.status];
  const busy = advance.isPending || cancel.isPending;
  const canChat = Boolean(request.worker && request.status !== 'PENDING' && request.status !== 'CANCELLED');
  const canCancel = request.status === 'ACCEPTED';
  const canCall = Boolean(request.customer?.phone);
  const isTerminal = request.status === 'COMPLETED' || request.status === 'CANCELLED';

  const confirmCancel = () => {
    Alert.alert(
      t('jobs.actions.cancelConfirmTitle'),
      t('jobs.actions.cancelConfirmMessage'),
      [
        { text: t('jobs.actions.keep'), style: 'cancel' },
        { text: t('jobs.actions.cancel'), style: 'destructive', onPress: () => cancel.mutate() },
      ],
    );
  };
  const actionLabel = request ? ACTION_LABEL_KEY[request.status] : undefined;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <JobScreenHeader status={request.status} onBack={() => navigation.goBack()} />

      {successMessage ? <Banner message={successMessage} /> : null}
      {requestQuery.isRefetchError ? <Banner tone="warning" message={t('errors.refreshFailed')} /> : null}
      {advance.isError ? <Banner tone="danger" message={t('jobs.error.update')} /> : null}
      {cancel.isError ? <Banner tone="danger" message={t('jobs.error.cancel')} /> : null}

      <JobTerminalStateCard request={request} />
      <JobSummaryCard request={request} />

      <PersonSummaryCard
        title={t('jobs.details.customer')}
        user={request.customer}
        actions={[
          ...(canChat ? [{
            label: t('jobs.details.message'),
            icon: 'chatbubble-outline' as const,
            primary: true,
            onPress: () => navigation.navigate('Chat', { requestId: effectiveId }),
            accessibilityLabel: t('jobs.details.messageCustomer'),
          }] : []),
          ...(canCall ? [{
            label: t('jobs.details.call'),
            icon: 'call-outline' as const,
            onPress: () => openPhone(request.customer?.phone),
            accessibilityLabel: t('jobs.details.callCustomer'),
          }] : []),
        ]}
      />

      <JobLocationCard
        address={request.address}
        lat={request.lat}
        lng={request.lng}
        onOpenMap={() => navigation.navigate('Map', {
          lat: request.lat,
          lng: request.lng,
          address: request.address,
          title: request.title,
          requestId: request.id,
        })}
        onOpenExternalNavigation={() => openExternalNavigation({
          address: request.address,
          lat: request.lat,
          lng: request.lng,
        })}
      />
      <JobDescriptionCard description={request.description} images={request.images} />
      <JobProgressTimeline request={request} />
      <JobPaymentCard request={request} label={t('jobs.details.paymentDetails')} />

      {!isTerminal ? (
        <Card>
          <Stack gap={spacing.md}>
            <H3>{t('jobs.actions.current')}</H3>
            {next ? (
              <Button
                title={actionLabel ? t(actionLabel) : t('jobs.actions.update')}
                loading={advance.isPending}
                disabled={busy && !advance.isPending}
                onPress={() => advance.mutate(next)}
                accessibilityLabel={actionLabel ? t(actionLabel) : t('jobs.actions.updateStatus')}
              />
            ) : (
              <BodySm color={colors.textSecondary}>{t('jobs.actions.noAction')}</BodySm>
            )}
            <Row gap={spacing.sm} wrap>
              {canChat ? (
                <Button
                  title={t('nav.chat')}
                  variant="outline"
                  size="sm"
                  fullWidth={false}
                  disabled={busy}
                  icon={<Ionicons name="chatbubble-outline" size={15} color={colors.textPrimary} />}
                  onPress={() => navigation.navigate('Chat', { requestId: effectiveId })}
                />
              ) : null}
              {canCancel ? (
                <Button
                  title={t('jobs.actions.cancel')}
                  variant="danger"
                  size="sm"
                  fullWidth={false}
                  loading={cancel.isPending}
                  disabled={busy && !cancel.isPending}
                  onPress={confirmCancel}
                />
              ) : null}
            </Row>
          </Stack>
        </Card>
      ) : (
        <Button
          title={t('jobs.actions.returnDashboard')}
          variant="outline"
          onPress={() => navigation.navigate('WorkerDashboard')}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.md },
  stateWrap: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
});
