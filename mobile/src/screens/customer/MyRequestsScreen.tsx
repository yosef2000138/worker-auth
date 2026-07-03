import React, { useCallback, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Body, BodySm, Button, Card, EmptyState, ErrorState, H2, ListSkeleton, Row, Screen, Stack, StatusBadge } from '@/components/ui';
import { formatAppDate, getLocalizedCategoryName, useLanguage } from '@/i18n';
import { requestService } from '@/services/requestService';
import { useAuthStore } from '@/store/authStore';
import { colors, spacing } from '@/theme';
import { Paginated, RootStackParamList, ServiceRequest } from '@/types';
import { queryKeys } from '@/utils/queryKeys';

type Props = NativeStackScreenProps<RootStackParamList, 'MyRequests'>;

const PAGE_SIZE = 20;

function getItems(data?: Paginated<ServiceRequest>) {
  return Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
}

function getPages(data?: Paginated<ServiceRequest>) {
  if (!data || Array.isArray(data)) return 1;
  return data.pagination?.pages ?? data.pages ?? 1;
}

export default function MyRequestsScreen({ navigation }: Props) {
  const { t, locale, language } = useLanguage();
  const user = useAuthStore(s => s.user);
  const [page, setPage] = useState(1);

  const query = useQuery({
    queryKey: [...queryKeys.customerRequests(user?.id, user?.role), 'page', page],
    queryFn: () => requestService.list({ page, limit: PAGE_SIZE }),
    enabled: Boolean(user?.id),
    retry: 1,
  });

  useFocusEffect(
    useCallback(() => {
      if (user?.id) void query.refetch();
    }, [query, user?.id]),
  );

  const items = getItems(query.data);
  const pages = getPages(query.data);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <H2>{t('requests.mine.title')}</H2>
        <BodySm color={colors.textSecondary}>{t('requests.mine.subtitle')}</BodySm>
      </View>

      {query.isLoading ? (
        <View style={styles.list}><ListSkeleton count={5} /></View>
      ) : query.isError ? (
        <ErrorState message={t('requests.mine.loadError')} onRetry={query.refetch} />
      ) : items.length === 0 ? (
        <EmptyState
          icon="clipboard-outline"
          title={t('requests.mine.emptyTitle')}
          message={t('requests.mine.emptyMessage')}
          actionLabel={t('customer.home.create')}
          onAction={() => navigation.navigate('CreateRequest')}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={colors.primary} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          ListFooterComponent={
            <Row gap={spacing.sm} style={styles.pager}>
              <Button
                title={t('common.back')}
                variant="outline"
                fullWidth={false}
                disabled={page <= 1 || query.isFetching}
                onPress={() => setPage(current => Math.max(1, current - 1))}
              />
              <BodySm color={colors.textSecondary} style={styles.pageLabel}>{t('requests.mine.page', { page, pages })}</BodySm>
              <Button
                title={t('common.next')}
                variant="outline"
                fullWidth={false}
                disabled={page >= pages || query.isFetching}
                onPress={() => setPage(current => Math.min(pages, current + 1))}
              />
            </Row>
          }
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('RequestDetails', { requestId: item.id })}>
              <Card>
                <Stack gap={spacing.sm}>
                  <Row justify="space-between" align="flex-start" gap={spacing.md}>
                    <Stack gap={spacing.xs} style={styles.main}>
                      <Body weight="bold">{item.title}</Body>
                      {item.category ? <BodySm color={colors.textSecondary}>{getLocalizedCategoryName(item.category, language.code, t)}</BodySm> : null}
                      {item.createdAt ? <BodySm color={colors.textTertiary}>{formatAppDate(item.createdAt, locale)}</BodySm> : null}
                    </Stack>
                    <StatusBadge status={item.status} />
                  </Row>
                  {item.description ? <BodySm color={colors.textSecondary} numberOfLines={2}>{item.description}</BodySm> : null}
                </Stack>
              </Card>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, gap: spacing.xs },
  list: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  main: { flex: 1 },
  pager: { justifyContent: 'center', alignItems: 'center', marginTop: spacing.lg },
  pageLabel: { minWidth: 96, textAlign: 'center' },
});
