import React from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { workerService } from '@/services/workerService';
import { Body, BodySm, Card, EmptyState, ErrorState, H2, ListSkeleton, Row, Screen, Stack } from '@/components/ui';
import { colors, spacing } from '@/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Categories'>;

export default function CategoriesScreen({ navigation }: Props) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['categories'],
    queryFn: workerService.categories,
  });

  if (isLoading) return <Screen><ListSkeleton count={5} /></Screen>;
  if (isError) return <Screen><ErrorState onRetry={refetch} /></Screen>;

  const categories = data ?? [];

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <H2>Choose a service</H2>
        <BodySm color={colors.textSecondary}>Pick a category to find workers or create a request.</BodySm>
      </View>

      {categories.length === 0 ? (
        <EmptyState
          icon="grid-outline"
          title="No categories yet"
          message="Ask an admin to add active service categories."
        />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => navigation.navigate('WorkerSearch', { categoryId: item.id })}
              style={({ pressed }) => pressed ? { opacity: 0.75 } : undefined}
            >
              <Card>
                <Row gap={spacing.md}>
                  <View style={styles.iconBox}>
                    <Ionicons name={(item.icon as any) || 'construct-outline'} size={22} color={colors.brand} />
                  </View>
                  <Stack gap={spacing.xs} style={{ flex: 1 }}>
                    <Body weight="bold">{item.name}</Body>
                    {item.description ? <BodySm color={colors.textSecondary}>{item.description}</BodySm> : null}
                  </Stack>
                  <Ionicons name="chevron-forward" size={18} color={colors.textTertiary} />
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
  header: { padding: spacing.lg, gap: spacing.xs },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing['4xl'] },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: colors.brandSoftest, alignItems: 'center', justifyContent: 'center' },
});
