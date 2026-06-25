import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Category, RootStackParamList, WorkerProfile } from '@/types';
import { workerService } from '@/services/workerService';
import { BodySm, Button, Field, EmptyState, ErrorState, H2, ListSkeleton, Screen, Stack } from '@/components/ui';
import { WorkerCard } from '@/components/worker';
import { colors, radius, spacing } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'WorkerSearch'>;

function normalizeWorkerCategories(worker: WorkerProfile): Category[] {
  return (worker.categories ?? []).map(category => ('category' in category ? category.category : category));
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.filterChip,
        selected && styles.filterChipActive,
        pressed && { opacity: 0.78 },
      ]}
    >
      <BodySm
        weight="semibold"
        color={selected ? colors.textInverse : colors.textSecondary}
        numberOfLines={1}
      >
        {label}
      </BodySm>
    </Pressable>
  );
}

export default function WorkerSearchScreen({ navigation, route }: Props) {
  const [query, setQuery] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState(route.params?.categoryId);

  useEffect(() => {
    setSelectedCategoryId(route.params?.categoryId);
  }, [route.params?.categoryId]);

  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: workerService.categories,
  });

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['workers', selectedCategoryId],
    queryFn: () => workerService.search({ categoryId: selectedCategoryId, limit: 50 }),
  });

  const all = useMemo<WorkerProfile[]>(
    () => Array.isArray(data) ? data : data?.items ?? data?.data ?? [],
    [data],
  );

  const selectedCategory = categories.find(category => category.id === selectedCategoryId);
  const searchText = query.trim().toLowerCase();
  const workers = useMemo(
    () => all.filter(worker => {
      if (!searchText) return true;

      const categoryNames = normalizeWorkerCategories(worker)
        .map(category => category.name)
        .join(' ');
      const searchable = [
        worker.user?.fullName,
        worker.bio,
        categoryNames,
      ].filter(Boolean).join(' ').toLowerCase();

      return searchable.includes(searchText);
    }),
    [all, searchText],
  );

  const resultLabel = `${workers.length} ${workers.length === 1 ? 'worker' : 'workers'}`;
  const emptyTitle = searchText ? 'No matching workers' : 'No workers found';
  const emptyMessage = selectedCategory
    ? `No workers are available for ${selectedCategory.name} yet. Try all workers.`
    : searchText
    ? 'Try another name, skill, or category.'
    : 'Try another category or create a request.';
  const emptyActionLabel = selectedCategoryId ? 'Show all workers' : searchText ? 'Clear search' : 'Browse categories';
  const emptyAction = selectedCategoryId
    ? () => setSelectedCategoryId(undefined)
    : searchText
    ? () => setQuery('')
    : () => navigation.navigate('Categories');

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Stack gap={spacing.xs}>
          <H2>Find workers</H2>
          <BodySm color={colors.textSecondary}>
            {selectedCategory ? `${resultLabel} for ${selectedCategory.name}` : `${resultLabel} available`}
          </BodySm>
        </Stack>
        <Field
          placeholder="Search workers by name or skill…"
          value={query}
          onChangeText={setQuery}
          leftIcon="search-outline"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        <FilterChip
          label="All"
          selected={!selectedCategoryId}
          onPress={() => setSelectedCategoryId(undefined)}
        />
        {categories.map(category => (
          <FilterChip
            key={category.id}
            label={category.name}
            selected={category.id === selectedCategoryId}
            onPress={() => setSelectedCategoryId(category.id)}
          />
        ))}
      </ScrollView>

      {isLoading ? (
        <View style={styles.listPad}><ListSkeleton count={4} /></View>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : workers.length === 0 ? (
        <EmptyState
          icon="people-outline"
          title={emptyTitle}
          message={emptyMessage}
          actionLabel={emptyActionLabel}
          onAction={emptyAction}
        />
      ) : (
        <FlatList
          data={workers}
          keyExtractor={w => w.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={refetch} />}
          ListFooterComponent={
            selectedCategoryId ? (
              <Button
                title="Show all workers"
                variant="outline"
                onPress={() => setSelectedCategoryId(undefined)}
                style={styles.footerButton}
              />
            ) : null
          }
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <WorkerCard
              worker={item}
              onPress={() => navigation.navigate('WorkerProfile', { workerId: item.id })}
            />
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md },
  filters: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  filterChip: {
    minHeight: 36,
    maxWidth: 180,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  listPad: { paddingHorizontal: spacing.lg },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing['3xl'] },
  footerButton: { marginTop: spacing.lg },
});
