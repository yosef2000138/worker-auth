import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { requestService } from '@/services/requestService';
import { useAuthStore } from '@/store/authStore';
import { Body, BodySm, Button, Card, EmptyState, H2, Row, Screen, Stack, StatusBadge } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { formatAppDate, getLocalizedCategoryName, useLanguage } from '@/i18n';
import { queryKeys } from '@/utils/queryKeys';
type Props = NativeStackScreenProps<RootStackParamList, 'CustomerHome'>;
export default function HomeScreen({ navigation }: Props) {
  const { t, locale, language } = useLanguage();
  const user = useAuthStore(s => s.user);
  const requestsQuery = useQuery({
    queryKey: [...queryKeys.customerRequests(user?.id, user?.role), 'preview'],
    queryFn: () => requestService.list({ limit: 5 }),
    enabled: Boolean(user?.id),
  });
  useFocusEffect(
    useCallback(() => {
      if (user?.id) void requestsQuery.refetch();
    }, [requestsQuery, user?.id]),
  );
  const { data } = requestsQuery;
  const items = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Stack gap={spacing.xs}>
          <H2>{t('customer.home.title')}</H2>
          <BodySm color={colors.textSecondary}>{t('customer.home.subtitle')}</BodySm>
        </Stack>
        <Row gap={spacing.sm} wrap>
          <Button title={t('customer.home.create')} fullWidth={false} style={styles.quickAction} onPress={() => navigation.navigate('CreateRequest')} />
          <Button title={t('customer.home.browseCategories')} fullWidth={false} variant="outline" style={styles.quickAction} onPress={() => navigation.navigate('Categories')} />
          <Button title={t('common.map')} fullWidth={false} variant="outline" style={styles.quickAction} onPress={() => navigation.navigate('Map')} />
        </Row>
        <Button title={t('nav.notifications')} variant="ghost" onPress={() => navigation.navigate('Notifications')} />
        <Button title={t('requests.mine.viewAll')} variant="outline" onPress={() => navigation.navigate('MyRequests')} />
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon="clipboard-outline"
          title={t('customer.home.noRequestsTitle')}
          message={t('customer.home.noRequestsMessage')}
          actionLabel={t('customer.home.browseCategories')}
          onAction={() => navigation.navigate('Categories')}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => {
            const canRate = item.status === 'COMPLETED' && Boolean(item.worker) && !item.review && item.canReview !== false;

            return (
              <Card>
                <Pressable onPress={() => navigation.navigate('RequestDetails', { requestId: item.id })}>
                <Row justify="space-between" align="flex-start">
                  <Stack gap={spacing.xs} style={{ flex: 1 }}>
                    <Body weight="bold">{item.title}</Body>
                    {item.category ? <BodySm color={colors.textSecondary}>{getLocalizedCategoryName(item.category, language.code, t)}</BodySm> : null}
                    {item.createdAt ? <BodySm color={colors.textTertiary}>{formatAppDate(item.createdAt, locale)}</BodySm> : null}
                  </Stack>
                  <StatusBadge status={item.status} />
                </Row>
                </Pressable>
                {canRate ? (
                  <Button
                    title={t('rating.open')}
                    variant="outline"
                    style={styles.rateButton}
                    onPress={() => navigation.navigate('Rating', { requestId: item.id })}
                  />
                ) : null}
              </Card>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, gap: spacing.md },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing['4xl'] },
  quickAction: { flexBasis: '31%', flexGrow: 1 },
  rateButton: { marginTop: spacing.md },
});
