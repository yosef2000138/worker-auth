import React, { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { requestService } from '@/services/requestService';
import { Banner, Body, BodySm, Button, Card, EmptyState, ErrorState, H2, ListSkeleton, Row, Screen, Stack, StatusBadge } from '@/components/ui';
import { MapPreview } from '@/components/map';
import { Paginated, RootStackParamList, ServiceRequest } from '@/types';
import { colors, spacing } from '@/theme';
import { formatAppDate, getLocalizedCategoryName, useLanguage } from '@/i18n';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function getItems(data?: Paginated<ServiceRequest>) {
  return Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
}

export default function IncomingRequestsScreen() {
  const { t, locale, language } = useLanguage();
  const navigation = useNavigation<Nav>();
  const queryClient = useQueryClient();
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['incoming'],
    queryFn: () => requestService.list({ status: 'PENDING', limit: 30 }),
  });
  const accept = useMutation({
    mutationFn: (requestId: string) => {
      setAcceptingId(requestId);
      setNotice('');
      return requestService.updateStatus(requestId, 'ACCEPTED');
    },
    onSuccess: (request) => {
      queryClient.invalidateQueries({ queryKey: ['incoming'] });
      queryClient.invalidateQueries({ queryKey: ['worker-requests'] });
      queryClient.setQueryData(['request', request.id], request);
      setNotice(t('worker.requests.accepted'));
      navigation.navigate('ActiveJob', { requestId: request.id });
    },
    onSettled: () => setAcceptingId(null),
  });

  const items = getItems(data).filter(item => item.status === 'PENDING');
  const acceptError = accept.isError ? t('errors.generic') : '';

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <H2>{t('worker.requests.title')}</H2>
        <BodySm color={colors.textSecondary}>{t('worker.requests.pendingNear', { count: items.length })}</BodySm>
        {notice ? <Banner tone="success" message={notice} /> : null}
        {accept.isError && acceptError ? <Banner tone="danger" message={acceptError} /> : null}
      </View>
      {isLoading ? (
        <View style={styles.list}><ListSkeleton count={4} /></View>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : items.length === 0 ? (
        <EmptyState icon="notifications-outline" title={t('worker.requests.emptyTitle')} message={t('worker.requests.emptyMessage')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <Card>
              <Stack gap={spacing.md}>
                <Row justify="space-between" align="flex-start">
                  <Stack gap={spacing.xs} style={{ flex: 1 }}>
                    <Body weight="bold">{item.title}</Body>
                    <BodySm color={colors.textSecondary}>{item.category ? getLocalizedCategoryName(item.category, language.code, t) : t('worker.requests.serviceRequest')}</BodySm>
                    {item.createdAt ? <BodySm color={colors.textTertiary}>{formatAppDate(item.createdAt, locale)}</BodySm> : null}
                  </Stack>
                  <StatusBadge status={item.status} />
                </Row>
                <BodySm color={colors.textSecondary}>{item.description}</BodySm>
                <MapPreview address={item.address} lat={item.lat} lng={item.lng} />
                <Row gap={spacing.sm} wrap>
                  <Button
                    title={t('common.details')}
                    variant="outline"
                    fullWidth={false}
                    style={styles.requestAction}
                    onPress={() => navigation.navigate('ActiveJob', { requestId: item.id })}
                  />
                  <Button
                    title={t('common.map')}
                    variant="outline"
                    fullWidth={false}
                    style={styles.requestAction}
                    onPress={() => navigation.navigate('Map', {
                      lat: item.lat,
                      lng: item.lng,
                      address: item.address,
                      title: item.title,
                      requestId: item.id,
                    })}
                  />
                  <Button
                    title={t('worker.requests.accept')}
                    fullWidth={false}
                    style={styles.requestAction}
                    loading={acceptingId === item.id}
                    disabled={accept.isPending && acceptingId !== item.id}
                    onPress={() => accept.mutate(item.id)}
                  />
                </Row>
              </Stack>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, gap: spacing.xs },
  list: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
  requestAction: { flexBasis: '31%', flexGrow: 1 },
});
