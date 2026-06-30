import React from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { workerService } from '@/services/workerService';
import { Avatar, Body, BodySm, Button, Card, EmptyState, ErrorState, H2, ListSkeleton, Row, Screen, Stack } from '@/components/ui';
import { RatingStars } from '@/components/ui/Rating';
import { Paginated, Review } from '@/types';
import { colors, spacing } from '@/theme';
import { formatAppDate, getLocalizedCategoryName, useLanguage } from '@/i18n';

function getItems(data?: Paginated<Review>) {
  return Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
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
});
