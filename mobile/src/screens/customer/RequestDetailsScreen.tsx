import React from 'react';
import { Alert, AppState, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RequestOffer, RequestOfferStatus, RootStackParamList } from '@/types';
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
import { Avatar, Badge, Banner, Body, BodySm, Button, Card, EmptyState, H3, Row, Stack } from '@/components/ui';
import { formatAppDate, formatCurrency, getPaymentStatusLabel, TranslationKey, useLanguage } from '@/i18n';
import { colors, spacing } from '@/theme';
import { localizedApiErrorMessage } from '@/utils/localizedErrors';
import { useAuthStore } from '@/store/authStore';
import { queryKeys } from '@/utils/queryKeys';

type Props = NativeStackScreenProps<RootStackParamList, 'RequestDetails'>;

function canSelectOffer(offer: RequestOffer) {
  return offer.status === 'SUBMITTED' || offer.status === 'DISCUSSING';
}

const offerStatusKeys: Record<RequestOfferStatus, TranslationKey> = {
  SUBMITTED: 'offers.status.submitted',
  DISCUSSING: 'offers.status.discussing',
  SELECTED: 'offers.status.selected',
  NOT_SELECTED: 'offers.status.notSelected',
  WITHDRAWN: 'offers.status.withdrawn',
  EXPIRED: 'offers.status.expired',
};

function formatOfferDuration(value: string | null | undefined, t: (key: TranslationKey) => string) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return value ?? '';
  if (minutes % (60 * 24) === 0) return `${minutes / (60 * 24)} ${t('offers.durationUnit.days')}`;
  if (minutes % 60 === 0) return `${minutes / 60} ${t('offers.durationUnit.hours')}`;
  return `${minutes} ${t('offers.durationUnit.minutes')}`;
}

export default function RequestDetailsScreen({ route, navigation }: Props) {
  const { requestId } = route.params;
  const { t, locale } = useLanguage();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  const requestQuery = useQuery({
    queryKey: queryKeys.request(requestId, user?.id),
    queryFn: () => requestService.getOne(requestId),
    enabled: Boolean(user?.id),
  });

  const request = requestQuery.data;
  const offersQuery = useQuery({
    queryKey: queryKeys.requestOffers(requestId, user?.id),
    queryFn: () => requestService.offers(requestId),
    enabled: Boolean(user?.id && request && request.status === 'PENDING' && !request.worker),
    retry: 1,
  });

  const paymentQuery = useQuery({
    queryKey: queryKeys.payment(requestId, user?.id),
    queryFn: () => paymentService.byRequest(requestId),
    enabled: Boolean(user?.id && request?.status === 'COMPLETED'),
  });

  const ratingEligibilityQuery = useQuery({
    queryKey: queryKeys.ratingEligibility(requestId, user?.id),
    queryFn: () => requestService.ratingEligibility(requestId),
    enabled: Boolean(user?.id && request?.status === 'COMPLETED'),
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
      queryClient.setQueryData(queryKeys.request(requestId, user?.id), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.request(requestId, user?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.customerRequests(user?.id, user?.role) });
    },
  });

  const confirmOffer = useMutation({
    mutationFn: (offerId: string) => requestService.confirmOffer(requestId, offerId),
    onSuccess: (result) => {
      setSuccessMessage(t('offers.selectedSuccess'));
      queryClient.setQueryData(queryKeys.request(requestId, user?.id), result.request);
      queryClient.invalidateQueries({ queryKey: queryKeys.request(requestId, user?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.requestOffers(requestId, user?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.customerRequests(user?.id, user?.role) });
    },
  });

  const refresh = React.useCallback(() => {
    setSuccessMessage(null);
    void requestQuery.refetch();
    if (request?.status === 'COMPLETED') {
      void paymentQuery.refetch();
      void ratingEligibilityQuery.refetch();
    }
    if (request?.status === 'PENDING' && !request.worker) {
      void offersQuery.refetch();
    }
  }, [offersQuery, paymentQuery, ratingEligibilityQuery, request?.status, request?.worker, requestQuery]);

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
  const offers = offersQuery.data?.items ?? [];
  const offerLimit = offersQuery.data?.limit ?? 5;
  const activeOfferCount = offersQuery.data?.count ?? request.offerCount ?? 0;
  const canChat = Boolean(request.worker && request.status !== 'PENDING' && request.status !== 'CANCELLED');
  const canCall = Boolean(request.worker?.user?.phone);
  const canCancel = ['PENDING', 'ACCEPTED', 'ON_THE_WAY'].includes(request.status);
  const ratingEligibility = ratingEligibilityQuery.data;
  const submittedReview = ratingEligibility?.review ?? request.review ?? null;
  const canReview = request.status === 'COMPLETED' && Boolean(ratingEligibility?.canRate ?? request.canReview);
  const alreadyRated = request.status === 'COMPLETED' && Boolean(ratingEligibility?.alreadyRated || submittedReview);
  const isTerminal = request.status === 'COMPLETED' || request.status === 'CANCELLED';
  const busy = cancel.isPending || confirmOffer.isPending;

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
  const confirmChooseOffer = (offer: RequestOffer) => {
    Alert.alert(
      t('offers.chooseConfirmTitle'),
      t('offers.chooseConfirmMessage', { name: offer.worker?.user?.fullName ?? t('common.worker') }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('offers.chooseWorker'), onPress: () => confirmOffer.mutate(offer.id) },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={requestQuery.isRefetching || paymentQuery.isRefetching || offersQuery.isRefetching} onRefresh={refresh} tintColor={colors.primary} />}
    >
      <JobScreenHeader status={request.status} onBack={() => navigation.goBack()} />

      {successMessage ? <Banner message={successMessage} /> : null}
      {requestQuery.isRefetchError ? <Banner tone="warning" message={t('requests.details.refreshFailed')} /> : null}
      {cancel.isError ? <Banner tone="danger" message={localizedApiErrorMessage(cancel.error, t, 'requests.details.cancelFailed')} /> : null}
      {confirmOffer.isError ? <Banner tone="danger" message={localizedApiErrorMessage(confirmOffer.error, t, 'offers.chooseFailed')} /> : null}
      {offersQuery.isError && request.status === 'PENDING' && !request.worker ? <Banner tone="warning" message={t('offers.loadFailed')} /> : null}
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
          <Stack gap={spacing.md}>
            <Stack gap={spacing.xs}>
              <H3>{t('offers.workerOffers')}</H3>
              <BodySm color={colors.textSecondary}>
                {t('offers.count', { count: activeOfferCount, limit: offerLimit })}
              </BodySm>
            </Stack>
            {offersQuery.isLoading ? (
              <BodySm color={colors.textSecondary}>{t('common.loading')}</BodySm>
            ) : offers.length === 0 ? (
              <BodySm color={colors.textSecondary}>{t('offers.empty')}</BodySm>
            ) : (
              <Stack gap={spacing.md}>
                {offers.map(offer => {
                  const worker = offer.worker;
                  const workerUser = worker?.user;
                  const selectable = canSelectOffer(offer) && request.status === 'PENDING';
                  return (
                    <View key={offer.id} style={styles.offerItem}>
                      <Stack gap={spacing.md}>
                        <Row justify="space-between" align="flex-start">
                          <Row style={{ flex: 1 }} align="flex-start">
                            <Avatar uri={workerUser?.avatarUrl} name={workerUser?.fullName} />
                            <Stack gap={spacing.xs} style={{ flex: 1 }}>
                              <Body weight="bold">{workerUser?.fullName ?? t('common.worker')}</Body>
                              <BodySm color={colors.textSecondary}>
                                {worker?.ratingAvg ? `${worker.ratingAvg.toFixed(1)} / 5` : t('reviews.newWorker')}
                                {worker?.totalJobs ? ` · ${t('customer.workerProfile.jobsDone')}: ${worker.totalJobs}` : ''}
                              </BodySm>
                            </Stack>
                          </Row>
                          <Badge label={t(offerStatusKeys[offer.status])} tone={offer.status === 'SELECTED' ? 'success' : offer.status === 'NOT_SELECTED' || offer.status === 'WITHDRAWN' || offer.status === 'EXPIRED' ? 'danger' : 'brand'} />
                        </Row>
                        <Stack gap={spacing.xs}>
                          {offer.proposedPrice ? (
                            <BodySm color={colors.textSecondary}>
                              {t('offers.proposedPrice')}: <BodySm weight="bold">{formatCurrency(offer.proposedPrice, locale)}</BodySm>
                            </BodySm>
                          ) : null}
                          {offer.estimatedDuration ? <BodySm color={colors.textSecondary}>{t('offers.duration')}: {formatOfferDuration(offer.estimatedDuration, t)}</BodySm> : null}
                          {offer.availableAt ? <BodySm color={colors.textSecondary}>{t('offers.availableAt')}: {formatAppDate(offer.availableAt, locale)}</BodySm> : null}
                          {offer.message ? <BodySm color={colors.textSecondary}>{offer.message}</BodySm> : null}
                        </Stack>
                        <Row gap={spacing.sm} wrap>
                          <Button
                            title={t('offers.chatWithWorker')}
                            variant="outline"
                            size="sm"
                            fullWidth={false}
                            style={styles.offerAction}
                            icon={<Ionicons name="chatbubble-outline" size={15} color={colors.textPrimary} />}
                            onPress={() => navigation.navigate('OfferChat', { requestId, offerId: offer.id })}
                          />
                          {worker ? (
                            <Button
                              title={t('common.profile')}
                              variant="outline"
                              size="sm"
                              fullWidth={false}
                              style={styles.offerAction}
                              icon={<Ionicons name="person-outline" size={15} color={colors.textPrimary} />}
                              onPress={() => navigation.navigate('WorkerProfile', { workerId: worker.id })}
                            />
                          ) : null}
                          {selectable ? (
                            <Button
                              title={t('offers.chooseWorker')}
                              size="sm"
                              fullWidth={false}
                              style={styles.offerAction}
                              loading={confirmOffer.isPending && confirmOffer.variables === offer.id}
                              disabled={busy && confirmOffer.variables !== offer.id}
                              onPress={() => confirmChooseOffer(offer)}
                            />
                          ) : null}
                        </Row>
                      </Stack>
                    </View>
                  );
                })}
              </Stack>
            )}
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
  offerItem: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
  offerAction: { flexBasis: '48%', flexGrow: 1 },
});
