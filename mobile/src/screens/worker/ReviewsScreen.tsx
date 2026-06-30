import React from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { workerService } from '@/services/workerService';
import { Avatar, Body, BodySm, Button, Card, EmptyState, ErrorState, H2, ListSkeleton, Row, Screen, Stack } from '@/components/ui';
import { RatingStars } from '@/components/ui/Rating';
import { Review, WorkerReviewsResponse } from '@/types';
import { colors, spacing } from '@/theme';
import { formatAppDate, getLocalizedCategoryName, useLanguage } from '@/i18n';

function getItems(data?: WorkerReviewsResponse | Review[]) {
  return Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
}

function RatingDistribution({
  distribution,
  total,
}: {
  distribution?: WorkerReviewsResponse['ratingDistribution'];
  total: number;
}) {
  const { t } = useLanguage();
  if (!distribution || total <= 0) return null;

  return (
    <Card>
      <Stack gap={spacing.sm}>
        <Body weight="bold">{t('reviews.ratingDistribution')}</Body>
        {[5, 4, 3, 2, 1].map(star => {
          const count = distribution[String(star) as keyof typeof distribution] ?? 0;
          const percent = total > 0 ? (count / total) * 100 : 0;
          return (
            <Row key={star} gap={spacing.sm}>
              <BodySm style={styles.starLabel}>{star}</BodySm>
              <View style={styles.distributionTrack}>
                <View style={[styles.distributionFill, { width: `${percent}%` }]} />
              </View>
              <BodySm color={colors.textSecondary} style={styles.distributionCount}>{count}</BodySm>
            </Row>
          );
        })}
      </Stack>
    </Card>
  );
}

export default function ReviewsScreen() {
  const { t, locale, language } = useLanguage();
  const workerQuery = useQuery({ queryKey: ['worker-me'], queryFn: workerService.me });
  const reviewsQuery = useInfiniteQuery({
    queryKey: ['worker-reviews', workerQuery.data?.id],
    queryFn: ({ pageParam }) => workerService.reviews(workerQuery.data!.id, pageParam, 10),
    initialPageParam: 1,
    enabled: !!workerQuery.data?.id,
    getNextPageParam: (lastPage, pages) => {
      if (Array.isArray(lastPage)) return undefined;
      const page = lastPage.pagination?.page ?? lastPage.page ?? pages.length;
      const totalPages = lastPage.pagination?.pages ?? lastPage.pages ?? 1;
      return page < totalPages ? page + 1 : undefined;
    },
  });
  const reviews = reviewsQuery.data?.pages.flatMap(page => getItems(page)) ?? [];
  const summary = reviewsQuery.data?.pages[0];
  const reviewCount = summary?.reviewCount ?? workerQuery.data?.totalReviews ?? 0;
  const averageRating = summary?.averageRating ?? workerQuery.data?.ratingAvg ?? 0;

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <H2>{t('reviews.customerReviews')}</H2>
        <RatingStars rating={averageRating ?? 0} count={reviewCount} />
        <BodySm color={colors.textSecondary}>{t('reviews.basedOn', { count: reviewCount })}</BodySm>
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
          ListHeaderComponent={<RatingDistribution distribution={summary?.ratingDistribution} total={reviewCount} />}
          ListFooterComponent={reviewsQuery.hasNextPage ? (
            <Button
              title={t('common.loadMore')}
              variant="outline"
              loading={reviewsQuery.isFetchingNextPage}
              onPress={() => reviewsQuery.fetchNextPage()}
            />
          ) : null}
          refreshControl={(
            <RefreshControl
              refreshing={workerQuery.isRefetching || reviewsQuery.isRefetching}
              onRefresh={() => {
                workerQuery.refetch();
                reviewsQuery.refetch();
              }}
              tintColor={colors.primary}
            />
          )}
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
                  {item.request?.title ? <BodySm color={colors.textSecondary}>{item.request.title}</BodySm> : null}
                  {item.request?.category ? (
                    <BodySm color={colors.textTertiary}>{getLocalizedCategoryName(item.request.category, language.code, t)}</BodySm>
                  ) : null}
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
  starLabel: { width: 18, textAlign: 'center' },
  distributionTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  distributionFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: colors.warning,
  },
  distributionCount: { width: 28, textAlign: 'right' },
});
