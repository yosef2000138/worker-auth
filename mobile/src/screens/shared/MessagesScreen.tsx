import React from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Avatar, Body, BodySm, Card, EmptyState, ErrorState, ListSkeleton, Row, Stack, StatusBadge } from '@/components/ui';
import { formatAppDate, useLanguage } from '@/i18n';
import { requestService } from '@/services/requestService';
import { useAuthStore } from '@/store/authStore';
import { Paginated, RootStackParamList, ServiceRequest } from '@/types';
import { colors, spacing } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Messages'>;

function getItems(data?: Paginated<ServiceRequest>) {
  return Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
}

function canChat(request: ServiceRequest) {
  return Boolean(request.worker && request.status !== 'PENDING' && request.status !== 'CANCELLED');
}

export default function MessagesScreen({ navigation }: Props) {
  const { t, locale } = useLanguage();
  const user = useAuthStore(s => s.user);
  const query = useQuery({
    queryKey: ['message-conversations'],
    queryFn: () => requestService.list({ limit: 50 }),
  });

  const conversations = getItems(query.data).filter(canChat);

  if (query.isLoading) {
    return <View style={styles.content}><ListSkeleton count={5} /></View>;
  }

  if (query.isError) {
    return <ErrorState message={t('messages.loadError')} onRetry={query.refetch} />;
  }

  if (conversations.length === 0) {
    return (
      <EmptyState
        icon="chatbubbles-outline"
        title={t('messages.emptyTitle')}
        message={t('messages.emptyMessage')}
      />
    );
  }

  return (
    <FlatList
      data={conversations}
      keyExtractor={item => item.id}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={colors.primary} />}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      renderItem={({ item }) => {
        const isWorker = user?.role === 'WORKER';
        const otherUser = isWorker ? item.customer : item.worker?.user;
        return (
          <Pressable
            onPress={() => navigation.navigate('Chat', { requestId: item.id })}
            accessibilityRole="button"
            accessibilityLabel={t('messages.openConversation', { title: item.title })}
            style={({ pressed }) => pressed ? { opacity: 0.76 } : undefined}
          >
            <Card>
              <Row gap={spacing.md} align="center">
                <Avatar uri={otherUser?.avatarUrl} name={otherUser?.fullName ?? item.title} size={48} />
                <Stack gap={spacing.xs} style={{ flex: 1 }}>
                  <Row justify="space-between" align="flex-start" gap={spacing.sm}>
                    <Body weight="bold" style={{ flex: 1 }}>{otherUser?.fullName ?? t('messages.conversation')}</Body>
                    <StatusBadge status={item.status} />
                  </Row>
                  <BodySm color={colors.textPrimary} numberOfLines={1}>{item.title}</BodySm>
                  {item.updatedAt || item.createdAt ? (
                    <BodySm color={colors.textTertiary}>{formatAppDate(item.updatedAt ?? item.createdAt, locale)}</BodySm>
                  ) : null}
                </Stack>
              </Row>
            </Card>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
});
