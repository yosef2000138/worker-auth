import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { workerService } from '@/services/workerService';
import { Body, BodySm, Card, EmptyState, ErrorState, H2, ListSkeleton, Row, Screen, Stack } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { formatDate, formatMoney } from '@/utils/formatters';

export default function EarningsScreen() {
  const { data, isLoading, isError, refetch } = useQuery({ queryKey: ['earnings'], queryFn: workerService.earnings, retry: false });
  const payments = data?.payments ?? [];

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <H2>Earnings</H2>
        <Row gap={spacing.md}>
          <Card style={styles.stat}>
            <BodySm color={colors.textSecondary}>Total</BodySm>
            <Body weight="bold" color={colors.success}>{formatMoney(Number(data?.totalEarnings ?? 0))}</Body>
          </Card>
          <Card style={styles.stat}>
            <BodySm color={colors.textSecondary}>Jobs</BodySm>
            <Body weight="bold">{data?.totalJobs ?? 0}</Body>
          </Card>
        </Row>
      </View>

      {isLoading ? (
        <View style={styles.list}><ListSkeleton count={3} /></View>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : payments.length === 0 ? (
        <EmptyState icon="cash-outline" title="No payments yet" message="Completed paid jobs will appear here." />
      ) : (
        <FlatList
          data={payments}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }: { item: any }) => (
            <Card>
              <Row justify="space-between">
                <Stack gap={spacing.xs} style={{ flex: 1 }}>
                  <Body weight="bold">{item.request?.title ?? 'Payment'}</Body>
                  <BodySm color={colors.textSecondary}>{formatDate(item.createdAt)}</BodySm>
                </Stack>
                <Body weight="bold" color={colors.success}>{formatMoney(Number(item.amount))}</Body>
              </Row>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, gap: spacing.md },
  list: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  stat: { flex: 1 },
});
