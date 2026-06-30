import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { workerService } from '@/services/workerService';
import { userService } from '@/services/userService';
import {
  Stack, Row, Card, Avatar, Badge, Button, H2, H3, Body, BodySm, Caption,
  ErrorState, ListSkeleton, Divider,
} from '@/components/ui';
import { RatingStars } from '@/components/ui/Rating';
import { formatAppDate, formatCurrency, getLocalizedCategoryName, useLanguage } from '@/i18n';
import { colors, spacing } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkerProfile'>;

function dayLabel(dayOfWeek: number, locale: string) {
  const sunday = new Date(Date.UTC(2024, 0, 7 + dayOfWeek));
  return formatAppDate(sunday, locale, { weekday: 'short' });
}

export default function WorkerProfileScreen({ route, navigation }: Props) {
  const { t, locale, language } = useLanguage();
  const { workerId } = route.params;
  const queryClient = useQueryClient();

  const { data: worker, isLoading, isError, refetch } = useQuery({
    queryKey: ['worker', workerId],
    queryFn: () => workerService.getOne(workerId),
  });

  const { data: favorites } = useQuery({
    queryKey: ['favorites'],
    queryFn: userService.favorites,
  });

  const isFavorite = favorites?.some(f => f.id === workerId) ?? false;

  const toggleFav = useMutation({
    mutationFn: () => isFavorite ? userService.removeFavorite(workerId) : userService.addFavorite(workerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });

  const { data: reviewsData } = useQuery({
    queryKey: ['reviews', workerId],
    queryFn: () => workerService.reviews(workerId),
    enabled: !!workerId,
  });
  const reviews = Array.isArray(reviewsData) ? reviewsData : reviewsData?.items ?? reviewsData?.data ?? [];

  const categories = (worker?.categories ?? []).map((c: any) => ('category' in c ? c.category : c));
  const price = worker?.hourlyRate != null
    ? `${formatCurrency(worker.hourlyRate, locale)}/${t('common.hoursShort')}`
    : worker?.fixedPrice != null
    ? `${formatCurrency(worker.fixedPrice, locale)} ${t('common.fixed')}`
    : null;
  const reviewCount = worker?.totalReviews ?? worker?.ratingCount ?? 0;
  const ratingLabel = reviewCount > 0 && worker?.ratingAvg != null
    ? worker.ratingAvg.toFixed(1)
    : t('reviews.newWorker');
  const primaryCategoryId = categories[0]?.id;
  const openRequest = () => navigation.navigate(
    'CreateRequest',
    primaryCategoryId ? { categoryId: primaryCategoryId } : undefined,
  );

  if (isLoading) return <View style={{ padding: spacing.lg }}><ListSkeleton count={3} /></View>;
  if (isError || !worker) return <ErrorState onRetry={refetch} />;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Hero */}
      <Card>
        <Row gap={spacing.lg} align="flex-start">
          <Avatar uri={worker.user?.avatarUrl} name={worker.user?.fullName} size={72} />
          <Stack gap={spacing.xs} style={{ flex: 1 }}>
            <Row justify="space-between" align="flex-start">
              <H2 style={{ flex: 1 }}>{worker.user?.fullName ?? t('common.workerRole')}</H2>
              <Ionicons
                name={isFavorite ? 'heart' : 'heart-outline'}
                size={22}
                color={isFavorite ? colors.danger : colors.textTertiary}
                onPress={() => toggleFav.mutate()}
                suppressHighlighting
              />
            </Row>
            <RatingStars
              rating={worker.ratingAvg ?? 0}
              count={reviewCount}
            />
            <Row gap={spacing.sm} wrap>
              {worker.isAvailable ? <Badge label={t('customer.workerProfile.availableNow')} tone="success" /> : <Badge label={t('common.unavailable')} tone="neutral" />}
              {price ? <Badge label={price} tone="brand" /> : null}
            </Row>
          </Stack>
        </Row>

        {worker.bio ? (
          <>
            <Divider style={{ marginVertical: spacing.md }} />
            <Body>{worker.bio}</Body>
          </>
        ) : null}

        <Divider style={{ marginVertical: spacing.md }} />
        <Row justify="space-around">
          {[
            { icon: 'briefcase-outline' as const, value: `${worker.totalJobs ?? 0}`, label: t('customer.workerProfile.jobsDone') },
            { icon: 'star-outline' as const, value: ratingLabel, label: t('customer.workerProfile.rating') },
            { icon: 'time-outline' as const, value: t('customer.workerProfile.yearsShort', { count: worker.yearsExp ?? 0 }), label: t('customer.workerProfile.experience') },
          ].map(stat => (
            <Stack key={stat.label} gap={2} style={{ alignItems: 'center' }}>
              <Ionicons name={stat.icon} size={18} color={colors.textSecondary} />
              <Body weight="bold">{stat.value}</Body>
              <Caption>{stat.label}</Caption>
            </Stack>
          ))}
        </Row>
      </Card>

      {/* Categories */}
      {categories.length > 0 && (
        <Card style={{ marginTop: spacing.md }}>
          <H3 style={{ marginBottom: spacing.sm }}>{t('customer.workerProfile.servicesOffered')}</H3>
          <Row gap={spacing.sm} wrap>
            {categories.map((c: any) => <Badge key={c.id} label={getLocalizedCategoryName(c, language.code, t)} tone="neutral" />)}
          </Row>
        </Card>
      )}

      {/* Availability */}
      {worker.availability && worker.availability.length > 0 && (
        <Card style={{ marginTop: spacing.md }}>
          <H3 style={{ marginBottom: spacing.sm }}>{t('customer.workerProfile.availability')}</H3>
          <Stack gap={spacing.xs}>
            {worker.availability.map(slot => (
              <Row key={slot.id} justify="space-between">
                <BodySm weight="semibold">{dayLabel(slot.dayOfWeek, locale)}</BodySm>
                <BodySm color={colors.textSecondary}>{slot.startTime} – {slot.endTime}</BodySm>
              </Row>
            ))}
          </Stack>
        </Card>
      )}

      {/* Reviews */}
      {reviews.length > 0 && (
        <Card style={{ marginTop: spacing.md }}>
          <H3 style={{ marginBottom: spacing.md }}>{t('customer.workerProfile.recentReviews')}</H3>
          <Stack gap={spacing.lg}>
            {reviews.slice(0, 3).map(r => (
              <Stack key={r.id} gap={spacing.xs}>
                <Row gap={spacing.sm}>
                  <Avatar uri={r.reviewer?.avatarUrl} name={r.reviewer?.fullName} size={32} />
                  <Stack gap={2} style={{ flex: 1 }}>
                    <Row justify="space-between">
                      <BodySm weight="semibold">{r.reviewer?.fullName ?? t('common.customer')}</BodySm>
                      <RatingStars rating={r.rating} showValue={false} size={12} />
                    </Row>
                    {r.comment ? <BodySm color={colors.textSecondary}>{r.comment}</BodySm> : null}
                  </Stack>
                </Row>
              </Stack>
            ))}
          </Stack>
        </Card>
      )}

      {/* CTA */}
      <Stack gap={spacing.sm} style={{ marginTop: spacing.lg }}>
        <Button
          title={t('customer.workerProfile.requestThisWorker')}
          onPress={openRequest}
        />
        <Button
          title={t('customer.workerProfile.createRequestToChat')}
          variant="outline"
          onPress={openRequest}
        />
      </Stack>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
});
