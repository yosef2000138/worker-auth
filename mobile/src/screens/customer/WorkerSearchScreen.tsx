import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Category, RootStackParamList, WorkerProfile } from '@/types';
import { workerService } from '@/services/workerService';
import { BodySm, Button, Field, EmptyState, ErrorState, H2, ListSkeleton, Screen, Stack } from '@/components/ui';
import { WorkerCard } from '@/components/worker';
import { getLocalizedCategoryName, useLanguage } from '@/i18n';
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
  const { t, language } = useLanguage();
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
  const selectedCategoryName = selectedCategory ? getLocalizedCategoryName(selectedCategory, language.code, t) : '';
  const searchText = query.trim().toLowerCase();
  const workers = useMemo(
    () => all.filter(worker => {
      if (!searchText) return true;

      const categoryNames = normalizeWorkerCategories(worker)
        .map(category => getLocalizedCategoryName(category, language.code, t))
        .join(' ');
      const searchable = [
        worker.user?.fullName,
        worker.bio,
        categoryNames,
      ].filter(Boolean).join(' ').toLowerCase();

      return searchable.includes(searchText);
    }),
    [all, language.code, searchText, t],
  );

  const resultLabel = workers.length === 1
    ? t('customer.workers.resultOne')
    : t('customer.workers.resultMany', { count: workers.length });
  const emptyTitle = searchText ? t('customer.workers.noMatchingTitle') : t('customer.workers.noFoundTitle');
  const emptyMessage = selectedCategory
    ? t('customer.workers.noAvailableForCategory', { category: selectedCategoryName })
    : searchText
    ? t('customer.workers.tryAnotherSearch')
    : t('customer.workers.tryAnotherCategory');
  const emptyActionLabel = selectedCategoryId ? t('customer.workers.showAll') : searchText ? t('customer.workers.clearSearch') : t('requests.create.browseCategories');
  const emptyAction = selectedCategoryId
    ? () => setSelectedCategoryId(undefined)
    : searchText
    ? () => setQuery('')
    : () => navigation.navigate('Categories');

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <Stack gap={spacing.xs}>
          <H2>{t('customer.workers.findTitle')}</H2>
          <BodySm color={colors.textSecondary}>
            {selectedCategory
              ? t('customer.workers.resultForCategory', { count: resultLabel, category: selectedCategoryName })
              : t('customer.workers.resultAvailable', { count: resultLabel })}
          </BodySm>
        </Stack>
        <Field
          placeholder={t('customer.workers.searchPlaceholder')}
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
          label={t('customer.workers.all')}
          selected={!selectedCategoryId}
          onPress={() => setSelectedCategoryId(undefined)}
        />
        {categories.map(category => (
          <FilterChip
            key={category.id}
            label={getLocalizedCategoryName(category, language.code, t)}
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
                title={t('customer.workers.showAll')}
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
