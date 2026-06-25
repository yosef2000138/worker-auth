import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { requestService } from '@/services/requestService';
import { Body, BodySm, Button, Card, EmptyState, ErrorState, H2, ListSkeleton, Row, Screen, Stack } from '@/components/ui';
import { MapPreview } from '@/components/map';
import { RootStackParamList } from '@/types';
import { colors, spacing } from '@/theme';
import { formatDate } from '@/utils/formatters';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function IncomingRequestsScreen() {
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['incoming'],
    queryFn: () => requestService.list({ status: 'PENDING', limit: 30 }),
  });
  const accept = useMutation({
    mutationFn: (requestId: string) => requestService.updateStatus(requestId, 'ACCEPTED'),
    onSuccess: (request) => {
      queryClient.invalidateQueries({ queryKey: ['incoming'] });
      queryClient.invalidateQueries({ queryKey: ['worker-requests'] });
      navigation.navigate('ActiveJob', { requestId: request.id });
    },
  });

  const items = (Array.isArray(data) ? data : data?.items ?? data?.data ?? []).filter(item => item.status === 'PENDING');

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <H2>Incoming requests</H2>
        <BodySm color={colors.textSecondary}>{items.length} pending jobs near you</BodySm>
      </View>
      {isLoading ? (
        <View style={styles.list}><ListSkeleton count={4} /></View>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : items.length === 0 ? (
        <EmptyState icon="notifications-outline" title="No incoming requests" message="Pending customer jobs will appear here." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('ActiveJob', { requestId: item.id })}>
              <Card>
                <Stack gap={spacing.md}>
                  <Row justify="space-between" align="flex-start">
                    <Stack gap={spacing.xs} style={{ flex: 1 }}>
                      <Body weight="bold">{item.title}</Body>
                      <BodySm color={colors.textSecondary}>{item.category?.name}</BodySm>
                      {item.createdAt ? <BodySm color={colors.textTertiary}>{formatDate(item.createdAt)}</BodySm> : null}
                    </Stack>
                    <BodySm weight="semibold" color={colors.brand}>PENDING</BodySm>
                  </Row>
                  <BodySm color={colors.textSecondary}>{item.description}</BodySm>
                  <MapPreview address={item.address} lat={item.lat} lng={item.lng} />
                  <Button
                    title="Accept job"
                    loading={accept.isPending}
                    onPress={() => accept.mutate(item.id)}
                  />
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
});
