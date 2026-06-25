import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { requestService } from '@/services/requestService';
import { Body, BodySm, Button, Card, EmptyState, H2, Row, Screen, Stack, StatusBadge } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { formatDate } from '@/utils/formatters';
type Props = NativeStackScreenProps<RootStackParamList, 'CustomerHome'>;
export default function HomeScreen({ navigation }: Props) {
  const { data } = useQuery({ queryKey: ['requests'], queryFn: () => requestService.list({ limit: 5 }) });
  const items = Array.isArray(data) ? data : data?.items ?? data?.data ?? [];

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Stack gap={spacing.xs}>
          <H2>Customer home</H2>
          <BodySm color={colors.textSecondary}>Create requests, find workers, and track jobs.</BodySm>
        </Stack>
        <Row gap={spacing.sm}>
          <Button title="Create" fullWidth={false} style={{ flex: 1 }} onPress={() => navigation.navigate('CreateRequest')} />
          <Button title="Workers" fullWidth={false} variant="outline" style={{ flex: 1 }} onPress={() => navigation.navigate('WorkerSearch')} />
        </Row>
        <Button title="Notifications" variant="ghost" onPress={() => navigation.navigate('Notifications')} />
      </View>

      {items.length === 0 ? (
        <EmptyState
          icon="clipboard-outline"
          title="No requests yet"
          message="Create your first service request when you are ready."
          actionLabel="Browse categories"
          onAction={() => navigation.navigate('Categories')}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <Pressable onPress={() => navigation.navigate('RequestDetails', { requestId: item.id })}>
              <Card>
                <Row justify="space-between" align="flex-start">
                  <Stack gap={spacing.xs} style={{ flex: 1 }}>
                    <Body weight="bold">{item.title}</Body>
                    {item.category?.name ? <BodySm color={colors.textSecondary}>{item.category.name}</BodySm> : null}
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
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing['4xl'] },
});
