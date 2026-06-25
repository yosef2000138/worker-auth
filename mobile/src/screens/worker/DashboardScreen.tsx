import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { requestService } from '@/services/requestService';
import { workerService } from '@/services/workerService';
import { Avatar, Body, BodySm, Button, Card, EmptyState, H2, ListSkeleton, Row, Screen, Stack, StatusBadge } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { formatDate } from '@/utils/formatters';
type Props = NativeStackScreenProps<RootStackParamList, 'WorkerDashboard'>;
export default function DashboardScreen({ navigation }: Props) {
  const { data: worker, isLoading: workerLoading } = useQuery({ queryKey: ['worker-me'], queryFn: workerService.me });
  const { data, isLoading } = useQuery({ queryKey: ['worker-requests'], queryFn: () => requestService.list({ limit: 8 }) });
  const items = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
  const active = items.filter(item => ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(item.status));
  const pending = items.filter(item => item.status === 'PENDING');
  const visible = [...active, ...pending].slice(0, 5);

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Row gap={spacing.md}>
          <Avatar uri={worker?.user?.avatarUrl} name={worker?.user?.fullName} size={52} />
          <Stack gap={spacing.xs} style={{ flex: 1 }}>
            <H2>{worker?.user?.fullName ?? 'Worker'}</H2>
            <BodySm color={colors.textSecondary}>
              {worker?.isAvailable ? 'Available for jobs' : 'Unavailable'}
            </BodySm>
          </Stack>
        </Row>
        <Row gap={spacing.sm}>
          <Button title={`${pending.length} incoming`} fullWidth={false} style={{ flex: 1 }} onPress={() => navigation.navigate('IncomingRequests')} />
          <Button title="Availability" variant="outline" fullWidth={false} style={{ flex: 1 }} onPress={() => navigation.navigate('Availability')} />
        </Row>
      </View>

      {workerLoading || isLoading ? (
        <View style={styles.list}><ListSkeleton count={4} /></View>
      ) : visible.length === 0 ? (
        <EmptyState
          icon="briefcase-outline"
          title="No jobs yet"
          message="Create a request from the customer account, then come back here to accept it."
          actionLabel="Check incoming"
          onAction={() => navigation.navigate('IncomingRequests')}
        />
      ) : (
        <FlatList
          data={visible}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('ActiveJob', { requestId: item.id })}>
              <Card>
                <Row justify="space-between" align="flex-start">
                  <Stack gap={spacing.xs} style={{ flex: 1 }}>
                    <Body weight="bold">{item.title}</Body>
                    <BodySm color={colors.textSecondary}>{item.address}</BodySm>
                    {item.createdAt ? <BodySm color={colors.textTertiary}>{formatDate(item.createdAt)}</BodySm> : null}
                  </Stack>
                  <StatusBadge status={item.status} />
                </Row>
              </Card>
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, gap: spacing.md },
  list: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
});
