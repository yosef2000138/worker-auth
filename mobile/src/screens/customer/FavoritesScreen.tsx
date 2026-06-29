import React from 'react';
import { FlatList, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { userService } from '@/services/userService';
import { Screen, EmptyState, ErrorState, ListSkeleton } from '@/components/ui';
import { WorkerCard } from '@/components/worker';
import { useLanguage } from '@/i18n';
import { spacing } from '@/theme';
import type { RootStackParamList } from '@/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function FavoritesScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['favorites'],
    queryFn: userService.favorites,
  });

  const removeFav = useMutation({
    mutationFn: (workerId: string) => userService.removeFavorite(workerId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites'] }),
  });

  if (isLoading) return <Screen><ListSkeleton count={3} /></Screen>;
  if (isError) return <Screen><ErrorState onRetry={refetch} /></Screen>;
  if (!data || data.length === 0) {
    return (
      <Screen>
        <EmptyState
          icon="heart-outline"
          title={t('customer.favorites.emptyTitle')}
          message={t('customer.favorites.emptyMessage')}
          actionLabel={t('customer.favorites.findWorkers')}
          onAction={() => navigation.navigate('WorkerSearch')}
        />
      </Screen>
    );
  }

  return (
    <FlatList
      data={data}
      keyExtractor={w => w.id}
      contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing['4xl'] }}
      ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
      renderItem={({ item }) => (
        <WorkerCard
          worker={item}
          isFavorite
          onToggleFavorite={() => removeFav.mutate(item.id)}
          onPress={() => navigation.navigate('WorkerProfile', { workerId: item.id })}
        />
      )}
    />
  );
}
