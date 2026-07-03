import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { reviewService } from '@/services/reviewService';
import type { RatingEligibility, RootStackParamList, ServiceRequest } from '@/types';
import { Avatar, Banner, Body, BodySm, Button, Card, EmptyState, Field, H2, H3, Row, Stack } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';
import { formatAppDate, getLocalizedCategoryName, useLanguage } from '@/i18n';
import { localizedApiErrorMessage } from '@/utils/localizedErrors';
import { useAuthStore } from '@/store/authStore';
import { queryKeys } from '@/utils/queryKeys';

type Props = NativeStackScreenProps<RootStackParamList, 'Rating'>;

const ratingLabels = [
  'rating.labels.one',
  'rating.labels.two',
  'rating.labels.three',
  'rating.labels.four',
  'rating.labels.five',
] as const;

export default function RatingScreen({ route, navigation }: Props) {
  const { requestId } = route.params;
  const { t, locale, language } = useLanguage();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const [rating, setRating] = React.useState<number | null>(null);
  const [comment, setComment] = React.useState('');
  const [duplicateNotice, setDuplicateNotice] = React.useState(false);

  const eligibilityQuery = useQuery({
    queryKey: queryKeys.ratingEligibility(requestId, user?.id),
    queryFn: () => reviewService.eligibility(requestId),
    enabled: Boolean(user?.id),
    retry: 1,
  });

  const submit = useMutation({
    mutationFn: () => reviewService.createForRequest(requestId, {
      rating: rating ?? 0,
      comment: comment.trim() || undefined,
    }),
    onMutate: () => {
      setDuplicateNotice(false);
    },
    onSuccess: (result) => {
      const review = result.review;
      queryClient.setQueryData<RatingEligibility | undefined>(
        queryKeys.ratingEligibility(requestId, user?.id),
        current => current ? { ...current, alreadyRated: true, canRate: false, review } : current,
      );
      queryClient.setQueryData<ServiceRequest | undefined>(
        queryKeys.request(requestId, user?.id),
        current => current ? { ...current, canReview: false, review } : current,
      );
      queryClient.invalidateQueries({ queryKey: queryKeys.request(requestId, user?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.ratingEligibility(requestId, user?.id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.customerRequests(user?.id, user?.role) });
      if (worker?.id) {
        queryClient.invalidateQueries({ queryKey: queryKeys.workerReviews(worker.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.reviews(worker.id, user?.id) });
        queryClient.invalidateQueries({ queryKey: queryKeys.worker(worker.id, user?.id) });
      }
    },
    onError: (error) => {
      const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
      if (code === 'REVIEW_ALREADY_EXISTS') {
        setDuplicateNotice(true);
        queryClient.invalidateQueries({ queryKey: queryKeys.request(requestId, user?.id) });
        void eligibilityQuery.refetch();
      }
    },
  });

  const eligibility = eligibilityQuery.data;
  const worker = eligibility?.worker;
  const request = eligibility?.request;
  const existingReview = submit.data?.review ?? eligibility?.review ?? null;
  const canRate = Boolean(eligibility?.canRate && !submit.data);
  const selectedLabel = rating ? t(ratingLabels[rating - 1]) : t('rating.selectRating');

  if (eligibilityQuery.isLoading) {
    return (
      <ScrollView style={styles.root} contentContainerStyle={styles.content}>
        <Card>
          <Stack gap={spacing.md}>
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonLine} />
            <View style={styles.skeletonLineShort} />
          </Stack>
        </Card>
      </ScrollView>
    );
  }

  if (eligibilityQuery.isError || !eligibility) {
    return (
      <View style={styles.stateWrap}>
        <EmptyState
          icon="warning-outline"
          title={t('rating.loadErrorTitle')}
          message={t('errors.tryAgain')}
          actionLabel={t('common.retry')}
          onAction={() => eligibilityQuery.refetch()}
        />
        <Button title={t('common.back')} variant="ghost" onPress={() => navigation.goBack()} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Stack gap={spacing.xs}>
        <H2>{t('rating.title')}</H2>
        <BodySm color={colors.textSecondary}>{t('rating.subtitle')}</BodySm>
      </Stack>

      {submit.isSuccess ? <Banner message={t('rating.submitted')} /> : null}
      {duplicateNotice ? <Banner tone="warning" message={t('rating.duplicateHandled')} /> : null}
      {submit.isError && !duplicateNotice ? <Banner tone="danger" message={localizedApiErrorMessage(submit.error, t, 'rating.submitFailed')} /> : null}

      <Card>
        <Row gap={spacing.md} align="center">
          <Avatar uri={worker?.user?.avatarUrl} name={worker?.user?.fullName} size={58} />
          <Stack gap={spacing.xs} style={{ flex: 1 }}>
            <Body weight="bold">{worker?.user?.fullName ?? t('common.worker')}</Body>
            <BodySm color={colors.textSecondary}>{t('rating.workerSummary')}</BodySm>
          </Stack>
        </Row>
        {request ? (
          <Stack gap={spacing.xs} style={styles.requestSummary}>
            <Body weight="bold">{request.title}</Body>
            {request.category ? (
              <BodySm color={colors.textSecondary}>{getLocalizedCategoryName(request.category, language.code, t)}</BodySm>
            ) : null}
            {request.completedAt ? (
              <BodySm color={colors.textTertiary}>{t('rating.completedOn', { date: formatAppDate(request.completedAt, locale) })}</BodySm>
            ) : null}
          </Stack>
        ) : null}
      </Card>

      {existingReview ? (
        <Card>
          <Stack gap={spacing.md}>
            <View style={styles.successIcon}>
              <Ionicons name="checkmark" size={28} color={colors.textInverse} />
            </View>
            <H3 center>{t('rating.yourReview')}</H3>
            <Row justify="center" gap={spacing.xs}>
              {[1, 2, 3, 4, 5].map(i => (
                <Ionicons
                  key={i}
                  name={i <= existingReview.rating ? 'star' : 'star-outline'}
                  size={24}
                  color={colors.warning}
                />
              ))}
            </Row>
            {existingReview.comment ? (
              <BodySm center color={colors.textSecondary}>{existingReview.comment}</BodySm>
            ) : null}
            {existingReview.createdAt ? (
              <BodySm center color={colors.textTertiary}>{formatAppDate(existingReview.createdAt, locale)}</BodySm>
            ) : null}
            <BodySm center color={colors.textSecondary}>{t('rating.onceFinal')}</BodySm>
            <Button title={t('common.done')} onPress={() => navigation.goBack()} />
          </Stack>
        </Card>
      ) : !eligibility.completed ? (
        <EmptyState
          icon="time-outline"
          title={t('rating.notCompletedTitle')}
          message={t('rating.notCompletedMessage')}
          actionLabel={t('common.back')}
          onAction={() => navigation.goBack()}
        />
      ) : !eligibility.hasWorker ? (
        <EmptyState
          icon="person-outline"
          title={t('rating.noWorkerTitle')}
          message={t('rating.noWorkerMessage')}
          actionLabel={t('common.back')}
          onAction={() => navigation.goBack()}
        />
      ) : (
        <Card>
          <Stack gap={spacing.lg}>
            <Stack gap={spacing.xs}>
              <H3>{t('rating.question')}</H3>
              <BodySm color={colors.textSecondary}>{t('rating.selectRating')}</BodySm>
            </Stack>

            <View style={styles.starRow}>
              {[1, 2, 3, 4, 5].map(i => (
                <Pressable
                  key={i}
                  style={({ pressed }) => [styles.starButton, pressed && { opacity: 0.72 }]}
                  onPress={() => setRating(i)}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.ratingOutOfFive', { rating: i })}
                  accessibilityState={{ selected: rating === i }}
                >
                  <Ionicons
                    name={rating !== null && i <= rating ? 'star' : 'star-outline'}
                    size={34}
                    color={colors.warning}
                  />
                </Pressable>
              ))}
            </View>
            <Body center weight="bold" color={colors.brand}>{selectedLabel}</Body>
            <BodySm center color={colors.textSecondary}>{t('rating.helpText')}</BodySm>

            <Field
              label={t('rating.feedbackLabel')}
              placeholder={t('rating.commentPlaceholder')}
              value={comment}
              onChangeText={setComment}
              multiline
              maxLength={1000}
              helperText={`${t('rating.feedbackOptional')} · ${t('rating.commentCount', { count: comment.length })}`}
              style={styles.commentInput}
            />

            <Button
              title={submit.isPending ? t('rating.submitting') : t('rating.submit')}
              loading={submit.isPending}
              disabled={!canRate || !rating || submit.isPending}
              onPress={() => submit.mutate()}
            />
            <Button
              title={t('rating.notNow')}
              variant="ghost"
              disabled={submit.isPending}
              onPress={() => navigation.goBack()}
            />
          </Stack>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing['4xl'] },
  stateWrap: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: 'center' },
  starButton: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    backgroundColor: colors.warningSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  requestSummary: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  commentInput: { minHeight: 112, textAlignVertical: 'top' },
  successIcon: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeletonTitle: { height: 26, width: '65%', borderRadius: radius.sm, backgroundColor: colors.border },
  skeletonLine: { height: 16, width: '88%', borderRadius: radius.sm, backgroundColor: colors.border },
  skeletonLineShort: { height: 16, width: '52%', borderRadius: radius.sm, backgroundColor: colors.border },
});
