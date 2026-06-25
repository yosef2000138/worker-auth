import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { requestService } from '@/services/requestService';
import { Screen, Stack, Row, Button, H3, BodySm, Caption, EmptyState, ErrorState, ListSkeleton } from '@/components/ui';
import { colors, fontWeight, radius, spacing } from '@/theme';
import { formatDate } from '@/utils/formatters';

export default function NotificationsScreen() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => requestService.notifications(),
  });

  const markAll = useMutation({
    mutationFn: requestService.markAllNotificationsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const items = Array.isArray(data) ? data : (data as any)?.items ?? (data as any)?.data ?? [];
  const unread = items.filter((n: any) => !n.isRead).length;

  return (
    <Screen padded={false}>
      {unread > 0 && (
        <View style={styles.header}>
          <BodySm weight="semibold" color={colors.textSecondary}>{unread} unread</BodySm>
          <Button
            title="Mark all read"
            variant="ghost"
            size="sm"
            fullWidth={false}
            loading={markAll.isPending}
            onPress={() => markAll.mutate()}
          />
        </View>
      )}

      {isLoading ? (
        <View style={{ padding: spacing.lg }}><ListSkeleton count={4} /></View>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : items.length === 0 ? (
        <EmptyState icon="notifications-outline" title="No notifications" message="You're all caught up." />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n: any) => n.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }: { item: any }) => (
            <Pressable style={[styles.item, !item.isRead && styles.itemUnread]}>
              <View style={[styles.dot, item.isRead && { opacity: 0 }]} />
              <Stack gap={4} style={{ flex: 1 }}>
                {item.title ? <Text style={styles.title}>{item.title}</Text> : null}
                <BodySm color={colors.textSecondary} numberOfLines={2}>
                  {item.body ?? item.message ?? ''}
                </BodySm>
                {item.createdAt ? <Caption>{formatDate(item.createdAt)}</Caption> : null}
              </Stack>
              <Ionicons name="chevron-forward" size={16} color={colors.textTertiary} />
            </Pressable>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderBottomWidth: 1, borderBottomColor: colors.border },
  list: { paddingBottom: spacing['3xl'] },
  sep: { height: 1, backgroundColor: colors.border },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  itemUnread: { backgroundColor: colors.brandSoftest },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand, flexShrink: 0 },
  title: { fontSize: 14, fontWeight: fontWeight.semibold, color: colors.textPrimary },
});
