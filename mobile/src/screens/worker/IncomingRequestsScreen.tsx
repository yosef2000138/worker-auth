import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { requestService } from '@/services/requestService';
import { WorkerProRequiredModal } from '@/components/subscriptions/WorkerProRequiredModal';
import {
  BackendSubscriptionResponse,
  backendSubscriptionQueryKey,
  subscriptionApi,
  updateCachedWorkerAccess,
  workerProQueryKey,
} from '@/features/subscriptions';
import { Banner, Body, BodySm, Button, Card, EmptyState, ErrorState, Field, H2, ListSkeleton, Row, Screen, Stack, StatusBadge } from '@/components/ui';
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
  if (typeof used === 'number' && typeof limit === 'number') return used < limit || Boolean(hasActiveSubscription);
  return Boolean(hasActiveSubscription);
}

function workerAccessFromError(error: unknown) {
  if (typeof error !== 'object' || error === null || !('details' in error)) return null;
  const details = (error as { details?: unknown }).details;
  if (typeof details !== 'object' || details === null) return null;
  if (
    !('freeAcceptedRequestLimit' in details) &&
    !('freeRequestLimit' in details) &&
    !('canAcceptRequest' in details) &&
    !('canAcceptMoreRequests' in details)
  ) {
    return null;
  }
  return details as WorkerAcceptanceAccess;
}

export default function IncomingRequestsScreen() {
  const { t, locale, language } = useLanguage();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [offeringId, setOfferingId] = useState<string | null>(null);
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerDuration, setOfferDuration] = useState('');
  const [offerAvailableAt, setOfferAvailableAt] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [notice, setNotice] = useState<{ tone: 'success' | 'warning'; message: string } | null>(null);
  const [paywallVisible, setPaywallVisible] = useState(false);
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
  const sendOffer = useMutation({
    mutationFn: (requestId: string) => {
      setOfferingId(requestId);
      setNotice(null);
      const price = Number(offerPrice);
      return requestService.createOffer(requestId, {
        proposedPrice: Number.isFinite(price) && price > 0 ? price : undefined,
        estimatedDuration: offerDuration.trim() || undefined,
        availableAt: offerAvailableAt.trim() || undefined,
        message: offerMessage.trim() || undefined,
      });
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['incoming'] });
      queryClient.invalidateQueries({ queryKey: ['worker-requests'] });
      if (result.workerAccess) {
        updateCachedWorkerAccess(queryClient, user?.id, result.workerAccess as WorkerAcceptanceAccess);
        queryClient.invalidateQueries({ queryKey: backendSubscriptionQueryKey(user?.id) });
        queryClient.invalidateQueries({ queryKey: workerProQueryKey(user?.id) });
      }
      setEditingOfferId(null);
      setOfferPrice('');
      setOfferDuration('');
      setOfferAvailableAt('');
      setOfferMessage('');
      setNotice({
        tone: 'success',
        message: t('offers.offerSent'),
      });
    },
    onError: (error) => {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      if (code === 'WORKER_SUBSCRIPTION_REQUIRED' || code === 'WORKER_PRO_REQUIRED') {
        const workerAccess = workerAccessFromError(error);
        if (workerAccess) {
          updateCachedWorkerAccess(queryClient, user?.id, workerAccess);
        }
        void backendAccessQuery.refetch();
        queryClient.invalidateQueries({ queryKey: backendSubscriptionQueryKey(user?.id) });
        setNotice({ tone: 'warning', message: t('errors.workerProRequired') });
        setPaywallVisible(true);
      }
    },
    onSettled: () => setOfferingId(null),
  });

  const latestWorkerAccess =
    queryClient.getQueryData<BackendSubscriptionResponse>(backendSubscriptionQueryKey(user?.id))?.workerAccess ??
    backendAccessQuery.data?.workerAccess;
  const items = getItems(data).filter(item => item.status === 'PENDING');
  const offerError = sendOffer.isError ? localizedApiErrorMessage(sendOffer.error, t, 'errors.generic') : '';
  const openWorkerPro = () => {
    queryClient.invalidateQueries({ queryKey: backendSubscriptionQueryKey(user?.id) });
    queryClient.invalidateQueries({ queryKey: workerProQueryKey(user?.id) });
    setPaywallVisible(false);
    navigation.navigate('Subscription');
  };
  const beginOffer = (requestId: string) => {
    setNotice(null);
    setEditingOfferId(current => current === requestId ? null : requestId);
  };
  const handleSendOffer = (requestId: string) => {
    const cachedAccess =
      queryClient.getQueryData<BackendSubscriptionResponse>(backendSubscriptionQueryKey(user?.id))?.workerAccess ??
      latestWorkerAccess;

    if (cachedAccess && !canAcceptFromAccess(cachedAccess)) {
      setNotice(null);
      setPaywallVisible(true);
      return;
    }

    sendOffer.mutate(requestId);
  };
  const offerBlocked = latestWorkerAccess ? !canAcceptFromAccess(latestWorkerAccess) : false;
  const offerErrorCode = sendOffer.isError && typeof sendOffer.error === 'object' && sendOffer.error !== null && 'code' in sendOffer.error
    ? String(sendOffer.error.code)
    : '';
  const showOfferError = sendOffer.isError && offerError && offerErrorCode !== 'WORKER_SUBSCRIPTION_REQUIRED' && offerErrorCode !== 'WORKER_PRO_REQUIRED';

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <H2>{t('worker.requests.title')}</H2>
        <BodySm color={colors.textSecondary}>{t('worker.requests.pendingNear', { count: items.length })}</BodySm>
        {notice ? <Banner tone={notice.tone} message={notice.message} /> : null}
        {showOfferError ? <Banner tone="danger" message={offerError} /> : null}
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
                {editingOfferId === item.id ? (
                  <Card style={styles.offerForm}>
                    <Stack gap={spacing.sm}>
                      <Body weight="bold">{t('offers.makeOffer')}</Body>
                      <Field
                        label={t('offers.price')}
                        value={offerPrice}
                        onChangeText={setOfferPrice}
                        keyboardType="decimal-pad"
                        placeholder={t('offers.pricePlaceholder')}
                        leftIcon="cash-outline"
                      />
                      <Field
                        label={t('offers.duration')}
                        value={offerDuration}
                        onChangeText={setOfferDuration}
                        placeholder={t('offers.durationPlaceholder')}
                        leftIcon="time-outline"
                      />
                      <Field
                        label={t('offers.availableAt')}
                        value={offerAvailableAt}
                        onChangeText={setOfferAvailableAt}
                        placeholder={t('offers.availableAtPlaceholder')}
                        leftIcon="calendar-outline"
                      />
                      <Field
                        label={t('offers.message')}
                        value={offerMessage}
                        onChangeText={setOfferMessage}
                        placeholder={t('offers.messagePlaceholder')}
                        leftIcon="chatbubble-outline"
                        multiline
                      />
                    </Stack>
                  </Card>
                ) : null}
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
                    title={offerBlocked ? t('subscription.subscribeToAccept') : editingOfferId === item.id ? t('offers.sendOffer') : t('offers.makeOffer')}
                    fullWidth={false}
                    style={styles.requestAction}
                    icon={offerBlocked ? <Ionicons name="lock-closed-outline" size={16} color={colors.textInverse} /> : undefined}
                    loading={offeringId === item.id}
                    disabled={sendOffer.isPending && offeringId !== item.id}
                    accessibilityLabel={offerBlocked ? t('subscription.subscribeToAcceptA11y') : t('offers.sendOffer')}
                    onPress={() => editingOfferId === item.id ? handleSendOffer(item.id) : beginOffer(item.id)}
                  />
                </Row>
              </Stack>
            </Card>
          )}
        />
      )}
      <WorkerProRequiredModal
        visible={paywallVisible}
        access={latestWorkerAccess}
        onClose={() => setPaywallVisible(false)}
        onViewWorkerPro={openWorkerPro}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, gap: spacing.xs },
  list: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  offerForm: { backgroundColor: colors.bg },
  requestAction: { flexBasis: '31%', flexGrow: 1 },
});
