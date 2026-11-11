import React, { useCallback } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { requestService } from '@/services/requestService';
import { useAuthStore } from '@/store/authStore';
import { Body, BodySm, Button, Card, EmptyState, H2, Row, Screen, SectionHeader, Stack, StatusBadge, StatusPill } from '@/components/ui';
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
  const activeCount = items.filter(item => item.status !== 'COMPLETED' && item.status !== 'CANCELLED').length;
  const completedCount = items.filter(item => item.status === 'COMPLETED').length;

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Stack gap={spacing.xs}>
          <H2>{t('customer.home.title')}</H2>
          <BodySm color={colors.textSecondary}>{t('customer.home.subtitle')}</BodySm>
        </Stack>
        <Button
          title={t('customer.home.createRequest')}
          icon={<Ionicons name="add-circle-outline" size={18} color={colors.textInverse} />}
          onPress={() => navigation.navigate('CreateRequest')}
        />
        <Row gap={spacing.sm} wrap>
          <Card style={styles.summaryCard}>
            <StatusPill label={t('customer.home.activeRequests')} tone="brand" icon="time-outline" />
            <Body weight="bold">{activeCount}</Body>
            <BodySm color={colors.textSecondary}>{t('customer.home.activeHint')}</BodySm>
          </Card>
          <Card style={styles.summaryCard}>
            <StatusPill label={t('customer.home.completedRequests')} tone="success" icon="checkmark-circle-outline" />
            <Body weight="bold">{completedCount}</Body>
            <BodySm color={colors.textSecondary}>{t('customer.home.completedHint')}</BodySm>
          </Card>
        </Row>
        <Row gap={spacing.sm} wrap>
          <Button title={t('requests.mine.viewAll')} fullWidth={false} variant="outline" style={styles.quickAction} onPress={() => navigation.navigate('MyRequests')} />
          <Button title={t('nav.notifications')} fullWidth={false} variant="outline" style={styles.quickAction} onPress={() => navigation.navigate('Notifications')} />
          <Button title={t('support.title')} fullWidth={false} variant="outline" style={styles.quickAction} onPress={() => navigation.navigate('Support')} />
        </Row>
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon="clipboard-outline"
          title={t('customer.home.noRequestsTitle')}
          message={t('customer.home.noActiveRequestsMessage')}
          actionLabel={t('customer.home.createRequest')}
          onAction={() => navigation.navigate('CreateRequest')}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <SectionHeader
              title={t('customer.home.recentRequests')}
              subtitle={t('customer.home.recentRequestsHint')}
              action={<Button title={t('common.all')} variant="ghost" size="sm" fullWidth={false} onPress={() => navigation.navigate('MyRequests')} />}
            />
          }
          ListHeaderComponentStyle={styles.listHeader}
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
  listHeader: { marginBottom: spacing.md },
  quickAction: { flexBasis: '31%', flexGrow: 1 },
  rateButton: { marginTop: spacing.md },
  summaryCard: { flexBasis: '48%', flexGrow: 1, gap: spacing.sm },
});
