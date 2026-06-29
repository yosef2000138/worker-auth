import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { workerService } from '@/services/workerService';
import { Avatar, Body, BodySm, Card, EmptyState, ErrorState, H2, ListSkeleton, Row, Screen, Stack } from '@/components/ui';
import { RatingStars } from '@/components/ui/Rating';
import { Paginated, Review } from '@/types';
import { colors, spacing } from '@/theme';
import { formatAppDate, useLanguage } from '@/i18n';

function getItems(data?: Paginated<Review>) {
  return Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
}

export default function ReviewsScreen() {
  const { t, locale } = useLanguage();
  const workerQuery = useQuery({ queryKey: ['worker-me'], queryFn: workerService.me });
  const reviewsQuery = useQuery({
    queryKey: ['worker-reviews', workerQuery.data?.id],
    queryFn: () => workerService.reviews(workerQuery.data!.id),
    enabled: !!workerQuery.data?.id,
  });
  const reviews = getItems(reviewsQuery.data);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <H2>{t('nav.reviews')}</H2>
        <RatingStars rating={workerQuery.data?.ratingAvg ?? 0} count={workerQuery.data?.totalReviews ?? 0} />
      </View>
      {workerQuery.isLoading || reviewsQuery.isLoading ? (
        <View style={styles.list}><ListSkeleton count={3} /></View>
      ) : workerQuery.isError || reviewsQuery.isError ? (
        <ErrorState message={t('reviews.loadError')} onRetry={() => { workerQuery.refetch(); reviewsQuery.refetch(); }} />
      ) : reviews.length === 0 ? (
        <EmptyState icon="star-outline" title={t('reviews.emptyTitle')} message={t('reviews.emptyMessage')} />
      ) : (
        <FlatList
          data={reviews}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <Card>
              <Row gap={spacing.md} align="flex-start">
                <Avatar uri={item.reviewer?.avatarUrl ?? item.customer?.avatarUrl} name={item.reviewer?.fullName ?? item.customer?.fullName} size={40} />
                <Stack gap={spacing.xs} style={{ flex: 1 }}>
                  <Row justify="space-between">
                    <Body weight="bold">{item.reviewer?.fullName ?? item.customer?.fullName ?? t('reviews.customer')}</Body>
                    <RatingStars rating={item.rating} showValue={false} />
                  </Row>
                  {item.comment ? <BodySm color={colors.textSecondary}>{item.comment}</BodySm> : null}
                  {item.createdAt ? <BodySm color={colors.textTertiary}>{formatAppDate(item.createdAt, locale)}</BodySm> : null}
                </Stack>
              </Row>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, gap: spacing.sm },
  list: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
});
