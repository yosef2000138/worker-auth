import React from 'react';
import { StyleSheet, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { WorkerProRequiredModal } from '@/components/subscriptions/WorkerProRequiredModal';
import { Banner, Body, BodySm, Button, Field, Row, Stack } from '@/components/ui';
import {
  BackendSubscriptionResponse,
  backendSubscriptionQueryKey,
  subscriptionApi,
  updateCachedWorkerAccess,
  workerProQueryKey,
} from '@/features/subscriptions';
import { CreateOfferPayload, requestService } from '@/services/requestService';
import { useAuthStore } from '@/store/authStore';
import type { RequestOfferStatus, ServiceRequest, WorkerAcceptanceAccess } from '@/types';
import { TranslationKey, useLanguage } from '@/i18n';
import { localizedApiErrorMessage } from '@/utils/localizedErrors';
import { queryKeys } from '@/utils/queryKeys';
import { colors, radius, spacing } from '@/theme';

type WorkerOfferState = {
  id: string;
  status: RequestOfferStatus;
} | null;

type Props = {
  request: ServiceRequest;
  myOffer?: WorkerOfferState;
  offerCount?: number;
  maxOffers?: number;
  offersOpen?: boolean;
  loadingOfferState?: boolean;
  compact?: boolean;
  onOpenChat: (offerId: string) => void;
  onOpenSubscription: () => void;
  onRefresh?: () => void;
};

type DurationUnit = 'minutes' | 'hours' | 'days';
type FieldErrors = Partial<Record<'price' | 'duration' | 'availableAt' | 'message', TranslationKey>>;

const ACTIVE_OFFER_STATUSES: RequestOfferStatus[] = ['SUBMITTED', 'DISCUSSING'];
const MAX_PRICE = 100000;
const MAX_DURATION_MINUTES = 60 * 24 * 30;
const MESSAGE_LIMIT = 1000;
const DURATION_MULTIPLIER: Record<DurationUnit, number> = {
  minutes: 1,
  hours: 60,
  days: 60 * 24,
};

function defaultFutureDate() {
  return new Date(Date.now() + 60 * 60 * 1000);
}

function canOfferFromAccess(access: WorkerAcceptanceAccess) {
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

function fieldErrorsFromApi(error: unknown): FieldErrors {
  if (typeof error !== 'object' || error === null || !('details' in error)) return {};
  const details = (error as { details?: unknown }).details;
  if (typeof details !== 'object' || details === null) return {};
  const fieldErrors: FieldErrors = {};

  for (const key of Object.keys(details)) {
    if (key === 'proposedPrice') fieldErrors.price = 'offers.validation.priceInvalid';
    if (key === 'estimatedDuration') fieldErrors.duration = 'offers.validation.durationInvalid';
    if (key === 'availableAt') fieldErrors.availableAt = 'offers.validation.availableAtInvalid';
    if (key === 'message') fieldErrors.message = 'offers.validation.messageTooLong';
  }

  return fieldErrors;
}

function parsePositiveNumber(value: string) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function buildPayload({
  price,
  duration,
  durationUnit,
  selectedAt,
  message,
}: {
  price: string;
  duration: string;
  durationUnit: DurationUnit;
  selectedAt: Date | null;
  message: string;
}) {
  const errors: FieldErrors = {};
  const proposedPrice = parsePositiveNumber(price);
  const durationValue = parsePositiveNumber(duration);
  const trimmedMessage = message.trim();

  if (proposedPrice === null) errors.price = 'offers.validation.priceRequired';
  else if (Number.isNaN(proposedPrice) || proposedPrice <= 0) errors.price = 'offers.validation.priceInvalid';
  else if (proposedPrice > MAX_PRICE) errors.price = 'offers.validation.priceMax';

  let estimatedDuration = 0;
  if (durationValue === null) {
    errors.duration = 'offers.validation.durationRequired';
  } else if (Number.isNaN(durationValue) || durationValue <= 0) {
    errors.duration = 'offers.validation.durationInvalid';
  } else {
    estimatedDuration = Math.round(durationValue * DURATION_MULTIPLIER[durationUnit]);
    if (estimatedDuration <= 0) errors.duration = 'offers.validation.durationInvalid';
    if (estimatedDuration > MAX_DURATION_MINUTES) errors.duration = 'offers.validation.durationMax';
  }

  if (!selectedAt) {
    errors.availableAt = 'offers.validation.availableAtRequired';
  } else if (selectedAt.getTime() <= Date.now()) {
    errors.availableAt = 'offers.validation.availableAtFuture';
  }

  if (trimmedMessage.length > MESSAGE_LIMIT) {
    errors.message = 'offers.validation.messageTooLong';
  }

  if (Object.keys(errors).length > 0 || proposedPrice === null || Number.isNaN(proposedPrice) || !selectedAt) {
    return { errors, payload: null };
  }

  const payload: CreateOfferPayload = {
    proposedPrice,
    estimatedDuration,
    availableAt: selectedAt.toISOString(),
    ...(trimmedMessage ? { message: trimmedMessage } : {}),
  };

  return { errors, payload };
}

function mergePickedDate(previous: Date | null, picked: Date, mode: 'date' | 'time') {
  const base = previous ?? defaultFutureDate();
  const next = new Date(base);

  if (mode === 'date') {
    next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
  } else {
    next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
  }

  return next;
}

export function WorkerOfferActionCard({
  request,
  myOffer,
  offerCount,
  maxOffers,
  offersOpen,
  loadingOfferState,
  compact,
  onOpenChat,
  onOpenSubscription,
  onRefresh,
}: Props) {
  const { t, locale } = useLanguage();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [editing, setEditing] = React.useState(false);
  const [price, setPrice] = React.useState('');
  const [duration, setDuration] = React.useState('');
  const [durationUnit, setDurationUnit] = React.useState<DurationUnit>('hours');
  const [selectedAt, setSelectedAt] = React.useState<Date | null>(null);
  const [pickerMode, setPickerMode] = React.useState<'date' | 'time' | null>(null);
  const [message, setMessage] = React.useState('');
  const [fieldErrors, setFieldErrors] = React.useState<FieldErrors>({});
  const [paywallVisible, setPaywallVisible] = React.useState(false);
  const [notice, setNotice] = React.useState<{ tone: 'success' | 'warning'; message: string } | null>(null);
  const [localOffer, setLocalOffer] = React.useState<WorkerOfferState>(null);

  React.useEffect(() => {
    if (myOffer) setLocalOffer(null);
  }, [myOffer?.id, myOffer?.status]);

  const accessQuery = useQuery({
    queryKey: backendSubscriptionQueryKey(user?.id),
    queryFn: subscriptionApi.me,
    enabled: Boolean(user?.id),
    retry: 1,
    staleTime: 0,
    refetchOnMount: 'always',
    refetchOnReconnect: true,
  });

  const latestWorkerAccess =
    queryClient.getQueryData<BackendSubscriptionResponse>(backendSubscriptionQueryKey(user?.id))?.workerAccess ??
    accessQuery.data?.workerAccess;

  const sendOffer = useMutation({
    mutationFn: (payload: CreateOfferPayload) => {
      if (__DEV__) {
        console.info('[make-offer] submit', {
          requestId: request.id,
          fields: Object.keys(payload),
          fieldTypes: Object.fromEntries(Object.entries(payload).map(([key, value]) => [key, typeof value])),
        });
      }
      return requestService.createOffer(request.id, payload);
    },
    onSuccess: (result) => {
      if (result.workerAccess) {
        updateCachedWorkerAccess(queryClient, user?.id, result.workerAccess);
      }
      setLocalOffer({ id: result.offer.id, status: result.offer.status });
      setEditing(false);
      setPrice('');
      setDuration('');
      setDurationUnit('hours');
      setSelectedAt(null);
      setMessage('');
      setFieldErrors({});
      setNotice({ tone: 'success', message: t('offers.offerSubmitted') });
      queryClient.invalidateQueries({ queryKey: queryKeys.request(request.id, user?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.requestOffers(request.id, user?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.incomingRequests(user?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.workerRequests(user?.id) });
      queryClient.invalidateQueries({ queryKey: backendSubscriptionQueryKey(user?.id) });
      queryClient.invalidateQueries({ queryKey: workerProQueryKey(user?.id) });
      onRefresh?.();
    },
    onError: (error) => {
      const workerAccess = workerAccessFromError(error);
      if (workerAccess) updateCachedWorkerAccess(queryClient, user?.id, workerAccess);
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      const apiFieldErrors = code === 'VALIDATION_ERROR' ? fieldErrorsFromApi(error) : {};
      if (Object.keys(apiFieldErrors).length > 0) {
        setFieldErrors(apiFieldErrors);
        setNotice({ tone: 'warning', message: t('offers.validation.fixFields') });
      } else {
        setNotice({ tone: 'warning', message: localizedApiErrorMessage(error, t, 'errors.generic') });
      }
      if (code === 'WORKER_SUBSCRIPTION_REQUIRED' || code === 'WORKER_PRO_REQUIRED') {
        setPaywallVisible(true);
      }
      queryClient.invalidateQueries({ queryKey: queryKeys.request(request.id, user?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.requestOffers(request.id, user?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.incomingRequests(user?.id) });
      onRefresh?.();
    },
  });

  const withdrawOffer = useMutation({
    mutationFn: (offerId: string) => requestService.withdrawOffer(request.id, offerId),
    onSuccess: (offer) => {
      setLocalOffer({ id: offer.id, status: offer.status });
      setNotice({ tone: 'success', message: t('offers.withdrawnSuccess') });
      queryClient.invalidateQueries({ queryKey: queryKeys.request(request.id, user?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.requestOffers(request.id, user?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.incomingRequests(user?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.workerRequests(user?.id) });
      onRefresh?.();
    },
    onError: (error) => {
      setNotice({ tone: 'warning', message: localizedApiErrorMessage(error, t, 'offers.withdrawFailed') });
      onRefresh?.();
    },
  });

  const effectiveOffer = localOffer ?? myOffer ?? null;
  const activeOffer = effectiveOffer && ACTIVE_OFFER_STATUSES.includes(effectiveOffer.status) ? effectiveOffer : null;
  const selectedOffer = effectiveOffer?.status === 'SELECTED';
  const notSelectedOffer = effectiveOffer?.status === 'NOT_SELECTED';
  const closedOffer = effectiveOffer?.status === 'WITHDRAWN' || effectiveOffer?.status === 'EXPIRED';
  const totalOffers = offerCount ?? request.offerCount ?? 0;
  const limit = maxOffers ?? request.maxOffers ?? 5;
  const isAssignedToMe = request.worker?.user?.id === user?.id || request.worker?.userId === user?.id;
  const assignedToAnother = request.status !== 'PENDING' && Boolean(request.worker) && !isAssignedToMe && !selectedOffer;
  const offerLimitReached = (offersOpen ?? request.offersOpen) === false && !activeOffer && request.status === 'PENDING';
  const accessLoading = accessQuery.isLoading && !latestWorkerAccess;
  const accessUnavailable = accessQuery.isError && !latestWorkerAccess;
  const canUseFreeOrPro = latestWorkerAccess ? canOfferFromAccess(latestWorkerAccess) : false;
  const busy = sendOffer.isPending || withdrawOffer.isPending || loadingOfferState;
  const canMakeOffer = request.status === 'PENDING' && !activeOffer && !offerLimitReached;
  const selectedAtLabel = selectedAt
    ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(selectedAt)
    : t('offers.availableAtPlaceholder');

  const openPaywall = () => {
    setPaywallVisible(true);
  };

  const submit = () => {
    setNotice(null);
    if (accessLoading) return;
    if (accessUnavailable) {
      void accessQuery.refetch();
      setNotice({ tone: 'warning', message: t('subscription.serverAccessUnavailable') });
      return;
    }
    if (!canUseFreeOrPro) {
      openPaywall();
      return;
    }

    const { errors, payload } = buildPayload({ price, duration, durationUnit, selectedAt, message });
    setFieldErrors(errors);
    if (!payload) {
      setNotice({ tone: 'warning', message: t('offers.validation.fixFields') });
      return;
    }

    sendOffer.mutate(payload);
  };

  const onDateTimeChange = (_event: DateTimePickerEvent, value?: Date) => {
    if (value && pickerMode) {
      setSelectedAt(current => mergePickedDate(current, value, pickerMode));
      setFieldErrors(current => ({ ...current, availableAt: undefined }));
    }
    setPickerMode(null);
  };

  if (loadingOfferState && !effectiveOffer) {
    return <BodySm color={colors.textSecondary}>{t('common.loading')}</BodySm>;
  }

  return (
    <Stack gap={spacing.md}>
      {notice ? <Banner tone={notice.tone} message={notice.message} /> : null}
      {accessUnavailable ? <Banner tone="warning" message={t('subscription.serverAccessUnavailable')} /> : null}
      {totalOffers > 0 && !activeOffer ? (
        <BodySm color={colors.textSecondary}>{t('offers.count', { count: totalOffers, limit })}</BodySm>
      ) : null}

      {activeOffer ? (
        <View style={styles.stateBox}>
          <Body weight="bold">{t('offers.offerSubmitted')}</Body>
          <BodySm color={colors.textSecondary}>{t('offers.waitingForCustomer')}</BodySm>
          <Row gap={spacing.sm} wrap>
            <Button
              title={t('offers.openChat')}
              variant="outline"
              size="sm"
              fullWidth={false}
              style={styles.action}
              icon={<Ionicons name="chatbubble-outline" size={15} color={colors.textPrimary} />}
              onPress={() => onOpenChat(activeOffer.id)}
            />
            <Button
              title={t('offers.withdrawOffer')}
              variant="outline"
              size="sm"
              fullWidth={false}
              style={styles.action}
              loading={withdrawOffer.isPending}
              disabled={busy && !withdrawOffer.isPending}
              onPress={() => withdrawOffer.mutate(activeOffer.id)}
            />
          </Row>
        </View>
      ) : null}

      {selectedOffer ? <Banner message={t('offers.selectedSuccess')} /> : null}
      {notSelectedOffer ? <Banner tone="warning" message={t('offers.myOfferNotSelected')} /> : null}
      {assignedToAnother ? <Banner tone="warning" message={t('offers.anotherWorkerSelected')} /> : null}
      {offerLimitReached ? (
        <View style={styles.stateBox}>
          <Body weight="bold">{t('offers.limitReachedShort')}</Body>
          <BodySm color={colors.textSecondary}>{t('offers.errorLimitReached')}</BodySm>
        </View>
      ) : null}
      {closedOffer && canMakeOffer ? (
        <Banner
          tone="warning"
          message={t(effectiveOffer.status === 'WITHDRAWN' ? 'offers.status.withdrawn' : 'offers.status.expired')}
        />
      ) : null}

      {canMakeOffer && !assignedToAnother && !notSelectedOffer ? (
        <Stack gap={spacing.md}>
          {editing ? (
            <View style={styles.offerForm}>
              <Stack gap={spacing.sm}>
                <Body weight="bold">{t('offers.makeOffer')}</Body>
                <Field
                  label={t('offers.price')}
                  value={price}
                  onChangeText={(value) => {
                    setPrice(value);
                    setFieldErrors(current => ({ ...current, price: undefined }));
                  }}
                  keyboardType="decimal-pad"
                  placeholder={t('offers.pricePlaceholder')}
                  leftIcon="cash-outline"
                />
                {fieldErrors.price ? <BodySm color={colors.danger}>{t(fieldErrors.price)}</BodySm> : null}

                <Field
                  label={t('offers.duration')}
                  value={duration}
                  onChangeText={(value) => {
                    setDuration(value);
                    setFieldErrors(current => ({ ...current, duration: undefined }));
                  }}
                  keyboardType="decimal-pad"
                  placeholder={t('offers.durationPlaceholder')}
                  leftIcon="time-outline"
                />
                <Row gap={spacing.sm} wrap>
                  {(['minutes', 'hours', 'days'] as DurationUnit[]).map(unit => (
                    <Button
                      key={unit}
                      title={t(`offers.durationUnit.${unit}`)}
                      variant={durationUnit === unit ? 'primary' : 'outline'}
                      size="sm"
                      fullWidth={false}
                      style={styles.unitButton}
                      onPress={() => setDurationUnit(unit)}
                    />
                  ))}
                </Row>
                {fieldErrors.duration ? <BodySm color={colors.danger}>{t(fieldErrors.duration)}</BodySm> : null}

                <Stack gap={spacing.xs}>
                  <BodySm weight="semibold">{t('offers.availableAt')}</BodySm>
                  <View style={styles.selectedTimeBox}>
                    <Ionicons name="calendar-outline" size={18} color={colors.textTertiary} />
                    <BodySm color={selectedAt ? colors.textPrimary : colors.textTertiary}>{selectedAtLabel}</BodySm>
                  </View>
                  <Row gap={spacing.sm} wrap>
                    <Button
                      title={t('offers.pickDate')}
                      variant="outline"
                      size="sm"
                      fullWidth={false}
                      style={styles.dateButton}
                      onPress={() => setPickerMode('date')}
                    />
                    <Button
                      title={t('offers.pickTime')}
                      variant="outline"
                      size="sm"
                      fullWidth={false}
                      style={styles.dateButton}
                      onPress={() => setPickerMode('time')}
                    />
                  </Row>
                  {pickerMode ? (
                    <DateTimePicker
                      value={selectedAt ?? defaultFutureDate()}
                      mode={pickerMode}
                      display="default"
                      minimumDate={new Date()}
                      onChange={onDateTimeChange}
                    />
                  ) : null}
                  {fieldErrors.availableAt ? <BodySm color={colors.danger}>{t(fieldErrors.availableAt)}</BodySm> : null}
                </Stack>

                <Field
                  label={t('offers.message')}
                  value={message}
                  onChangeText={(value) => {
                    setMessage(value);
                    setFieldErrors(current => ({ ...current, message: undefined }));
                  }}
                  placeholder={t('offers.messagePlaceholder')}
                  helperText={t('offers.validation.messageLimit', { count: MESSAGE_LIMIT })}
                  leftIcon="chatbubble-outline"
                  multiline
                />
                {fieldErrors.message ? <BodySm color={colors.danger}>{t(fieldErrors.message)}</BodySm> : null}
              </Stack>
            </View>
          ) : null}
          <Button
            title={
              accessLoading
                ? t('common.loading')
                : accessUnavailable
                ? t('common.retry')
                : !canUseFreeOrPro
                ? t('offers.subscribeToMakeOffer')
                : editing
                ? t('offers.sendOffer')
                : t('offers.makeOffer')
            }
            loading={sendOffer.isPending}
            disabled={(busy && !sendOffer.isPending) || accessLoading}
            icon={
              !accessLoading && !accessUnavailable && !canUseFreeOrPro
                ? <Ionicons name="lock-closed-outline" size={16} color={colors.textInverse} />
                : undefined
            }
            onPress={() => {
              if (accessUnavailable) {
                void accessQuery.refetch();
                return;
              }
              if (!canUseFreeOrPro) {
                openPaywall();
                return;
              }
              if (!editing) {
                setNotice(null);
                setEditing(true);
                return;
              }
              submit();
            }}
          />
          {editing && !compact ? (
            <Button title={t('common.cancel')} variant="ghost" onPress={() => setEditing(false)} disabled={sendOffer.isPending} />
          ) : null}
        </Stack>
      ) : null}

      <WorkerProRequiredModal
        visible={paywallVisible}
        access={latestWorkerAccess}
        onClose={() => setPaywallVisible(false)}
        onViewWorkerPro={() => {
          setPaywallVisible(false);
          onOpenSubscription();
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  action: { flexBasis: '48%', flexGrow: 1 },
  dateButton: { flexBasis: '48%', flexGrow: 1 },
  offerForm: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    padding: spacing.md,
  },
  selectedTimeBox: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stateBox: {
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    padding: spacing.md,
  },
  unitButton: { flexBasis: '31%', flexGrow: 1 },
});
