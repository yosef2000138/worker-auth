import React from 'react';
import { Alert, AppState, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { requestService } from '@/services/requestService';
import { paymentService } from '@/services/paymentService';
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
import { Banner, Body, BodySm, Button, Card, EmptyState, H3, Row, Stack } from '@/components/ui';
import { formatAppDate, formatCurrency, getPaymentStatusLabel, useLanguage } from '@/i18n';
import { colors, spacing } from '@/theme';
import { localizedApiErrorMessage } from '@/utils/localizedErrors';

type Props = NativeStackScreenProps<RootStackParamList, 'RequestDetails'>;

export default function RequestDetailsScreen({ route, navigation }: Props) {
  const { requestId } = route.params;
  const { t, locale } = useLanguage();
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const requestQuery = useQuery({
    queryKey: ['request', requestId],
    queryFn: () => requestService.getOne(requestId),
  });

  const request = requestQuery.data;

  const paymentQuery = useQuery({
    queryKey: ['payment', requestId],
    queryFn: () => paymentService.byRequest(requestId),
    enabled: request?.status === 'COMPLETED',
  });

  const ratingEligibilityQuery = useQuery({
    queryKey: ['rating-eligibility', requestId],
    queryFn: () => requestService.ratingEligibility(requestId),
    enabled: request?.status === 'COMPLETED',
    retry: 1,
  });

  const refetchRequest = requestQuery.refetch;

  React.useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') {
        void refetchRequest();
      }
    });

    return () => subscription.remove();
  }, [refetchRequest]);

  const cancel = useMutation({
    mutationFn: () => requestService.cancel(requestId, 'Cancelled by customer'),
    onSuccess: (updated) => {
      setSuccessMessage(t('requests.details.cancelled'));
      queryClient.setQueryData(['request', requestId], updated);
      queryClient.invalidateQueries({ queryKey: ['request', requestId] });
      queryClient.invalidateQueries({ queryKey: ['requests'] });
    },
  });

  const refresh = React.useCallback(() => {
    setSuccessMessage(null);
    void requestQuery.refetch();
    if (request?.status === 'COMPLETED') {
      void paymentQuery.refetch();
      void ratingEligibilityQuery.refetch();
    }
  }, [paymentQuery, ratingEligibilityQuery, request?.status, requestQuery]);

  if (requestQuery.isLoading) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <JobLoadingSkeleton />
      </ScrollView>
    );
  }

  if (requestQuery.isError || !request) {
    return (
      <View style={styles.stateWrap}>
        <EmptyState
          icon="warning-outline"
          title={t('requests.details.loadErrorTitle')}
          message={t('errors.tryAgain')}
          actionLabel={t('common.retry')}
          onAction={() => requestQuery.refetch()}
        />
        <Button title={t('common.back')} variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  const payment = paymentQuery.data;
  const canChat = Boolean(request.worker && request.status !== 'PENDING' && request.status !== 'CANCELLED');
  const canCall = Boolean(request.worker?.user?.phone);
  const canCancel = ['PENDING', 'ACCEPTED', 'ON_THE_WAY'].includes(request.status);
  const ratingEligibility = ratingEligibilityQuery.data;
  const submittedReview = ratingEligibility?.review ?? request.review ?? null;
  const canReview = request.status === 'COMPLETED' && Boolean(ratingEligibility?.canRate ?? request.canReview);
  const alreadyRated = request.status === 'COMPLETED' && Boolean(ratingEligibility?.alreadyRated || submittedReview);
  const isTerminal = request.status === 'COMPLETED' || request.status === 'CANCELLED';
  const busy = cancel.isPending;

  const confirmCancel = () => {
    Alert.alert(
      t('requests.details.cancelConfirmTitle'),
      t('requests.details.cancelConfirmMessage'),
      [
        { text: t('requests.details.keepJob'), style: 'cancel' },
        { text: t('requests.details.cancelJob'), style: 'destructive', onPress: () => cancel.mutate() },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={requestQuery.isRefetching || paymentQuery.isRefetching} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <JobScreenHeader status={request.status} onBack={() => navigation.goBack()} />

      {successMessage ? <Banner message={successMessage} /> : null}
      {requestQuery.isRefetchError ? <Banner tone="warning" message={t('requests.details.refreshFailed')} /> : null}
      {cancel.isError ? <Banner tone="danger" message={localizedApiErrorMessage(cancel.error, t, 'requests.details.cancelFailed')} /> : null}
      {ratingEligibilityQuery.isError && request.status === 'COMPLETED' ? <Banner tone="warning" message={t('rating.loadErrorTitle')} /> : null}

      <JobTerminalStateCard request={request} />
      <JobSummaryCard request={request} />

      <PersonSummaryCard
        title={t('requests.details.worker')}
        user={request.worker?.user}
        worker={request.worker ?? null}
        actions={[
          ...(canChat ? [{
            label: t('jobs.details.message'),
            icon: 'chatbubble-outline' as const,
            primary: true,
            onPress: () => navigation.navigate('Chat', { requestId }),
            accessibilityLabel: t('requests.details.messageWorker'),
          }] : []),
          ...(canCall ? [{
            label: t('jobs.details.call'),
            icon: 'call-outline' as const,
            onPress: () => openPhone(request.worker?.user?.phone),
            accessibilityLabel: t('requests.details.callWorker'),
          }] : []),
          ...(request.worker ? [{
            label: t('common.profile'),
            icon: 'person-outline' as const,
            onPress: () => navigation.navigate('WorkerProfile', { workerId: request.worker!.id }),
            accessibilityLabel: t('requests.details.workerProfile'),
          }] : []),
        ]}
      />

      {!request.worker && request.status === 'PENDING' ? (
        <Card>
          <Stack gap={spacing.sm}>
            <H3>{t('requests.details.waitingTitle')}</H3>
            <BodySm color={colors.textSecondary}>{t('requests.details.waitingBody')}</BodySm>
          </Stack>
        </Card>
      ) : null}

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
      <JobPaymentCard request={request} />

      {payment ? (
        <Card>
          <Stack gap={spacing.md}>
            <H3>{t('requests.details.paymentReceipt')}</H3>
            <Row justify="space-between">
              <BodySm color={colors.textSecondary}>{t('requests.details.amountPaid')}</BodySm>
              <Body weight="bold" color={colors.success}>{formatCurrency(payment.amount, locale)}</Body>
            </Row>
            {payment.status ? (
              <Row justify="space-between">
                <BodySm color={colors.textSecondary}>{t('common.status')}</BodySm>
                <BodySm weight="bold">
                  {getPaymentStatusLabel(payment.status, t)}
                </BodySm>
              </Row>
            ) : null}
            {payment.createdAt ? (
              <Row justify="space-between">
                <BodySm color={colors.textSecondary}>{t('requests.details.paidOn')}</BodySm>
                <BodySm weight="bold">{formatAppDate(payment.createdAt, locale)}</BodySm>
              </Row>
            ) : null}
          </Stack>
        </Card>
      ) : null}

      {canReview ? (
        <Card>
          <Stack gap={spacing.md}>
            <H3>{t('rating.title')}</H3>
            <BodySm color={colors.textSecondary}>{t('requests.details.leaveReviewBody')}</BodySm>
            <Button
              title={t('rating.open')}
              variant="outline"
              onPress={() => navigation.navigate('Rating', { requestId })}
              accessibilityLabel={t('requests.details.writeReviewA11y')}
            />
          </Stack>
        </Card>
      ) : null}

      {alreadyRated ? (
        <Card>
          <Stack gap={spacing.md}>
            <H3>{t('rating.yourReview')}</H3>
            <BodySm color={colors.textSecondary}>{t('rating.alreadyRatedMessage')}</BodySm>
            {submittedReview?.rating ? (
              <Row gap={spacing.xs}>
                {[1, 2, 3, 4, 5].map(i => (
                  <Ionicons
                    key={i}
                    name={i <= (submittedReview.rating ?? 0) ? 'star' : 'star-outline'}
                    size={22}
                    color={colors.warning}
                  />
                ))}
              </Row>
            ) : null}
            {submittedReview?.comment ? (
              <BodySm color={colors.textSecondary}>{submittedReview.comment}</BodySm>
            ) : null}
            {submittedReview?.createdAt ? (
              <BodySm color={colors.textTertiary}>{formatAppDate(submittedReview.createdAt, locale)}</BodySm>
            ) : null}
            <BodySm color={colors.textSecondary}>{t('rating.onceFinal')}</BodySm>
          </Stack>
        </Card>
      ) : null}

      {!isTerminal ? (
        <Card>
          <Stack gap={spacing.md}>
            <H3>{t('common.actions')}</H3>
            {canChat ? (
              <Button
                title={t('requests.details.openChat')}
                icon={<Ionicons name="chatbubble-outline" size={16} color={colors.textInverse} />}
                onPress={() => navigation.navigate('Chat', { requestId })}
                disabled={busy}
              />
            ) : null}
            {canCancel ? (
              <Button
                title={t('requests.details.cancelJob')}
                variant="danger"
                loading={cancel.isPending}
                disabled={busy && !cancel.isPending}
                onPress={confirmCancel}
              />
            ) : null}
            {!canChat && !canCancel ? (
              <BodySm color={colors.textSecondary}>{t('requests.details.noCustomerAction')}</BodySm>
            ) : null}
          </Stack>
        </Card>
      ) : (
        <Button title={t('requests.details.returnHome')} variant="outline" onPress={() => navigation.navigate('CustomerHome')} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.md },
  stateWrap: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
});
