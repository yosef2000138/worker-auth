import React from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { WorkerOfferActionCard } from '@/components/offers/WorkerOfferActionCard';
import { MapPreview } from '@/components/map';
import { Body, BodySm, Button, Card, EmptyState, ErrorState, H2, InfoRow, Row, Screen, SectionHeader, Stack, StatusBadge, StatusPill } from '@/components/ui';
import { requestService } from '@/services/requestService';
import { Paginated, RequestOfferStatus, RootStackParamList, ServiceRequest } from '@/types';
import { colors, spacing } from '@/theme';
import { formatAppDate, getLocalizedCategoryName, useLanguage } from '@/i18n';
import { useAuthStore } from '@/store/authStore';
import { queryKeys } from '@/utils/queryKeys';

type Nav = NativeStackNavigationProp<RootStackParamList>;

function getItems(data?: Paginated<ServiceRequest>) {
  return Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
}

function myOfferFromRequest(item: ServiceRequest) {
  if (!item.myOfferId || !item.myOfferStatus) return null;
  return {
    id: item.myOfferId,
    status: item.myOfferStatus as RequestOfferStatus,
  };
}

export default function IncomingRequestsScreen() {
  const { t, locale, language } = useLanguage();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore(s => s.user);
  const { data, isLoading, isError, isRefetching, refetch } = useQuery({
    queryKey: queryKeys.incomingRequests(user?.id),
    queryFn: () => requestService.list({ status: 'PENDING', limit: 30 }),
    enabled: Boolean(user?.id),
  });

  useFocusEffect(
    React.useCallback(() => {
      if (user?.id) void refetch();
    }, [refetch, user?.id]),
  );

  const items = getItems(data).filter(item => item.status === 'PENDING');

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <H2>{t('worker.requests.title')}</H2>
        <BodySm color={colors.textSecondary}>{t('worker.requests.pendingNear', { count: items.length })}</BodySm>
        <BodySm color={colors.textSecondary}>{t('worker.requests.helper')}</BodySm>
      </View>
      {isLoading ? (
        <View style={styles.list}>
          <Stack>
            {[0, 1, 2, 3].map(index => <View key={index} style={styles.skeleton} />)}
          </Stack>
        </View>
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : items.length === 0 ? (
        <EmptyState icon="notifications-outline" title={t('worker.requests.emptyTitle')} message={t('worker.requests.emptyMessage')} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <SectionHeader
              title={t('worker.requests.openJobs')}
              subtitle={t('worker.requests.openJobsHint')}
            />
          }
          ListHeaderComponentStyle={styles.listHeader}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
          renderItem={({ item }) => (
            <Card>
              <Stack gap={spacing.md}>
                <Row justify="space-between" align="flex-start">
                  <Stack gap={spacing.xs} style={{ flex: 1 }}>
                    <Body weight="bold">{item.title}</Body>
                    <StatusPill
                      label={item.category ? getLocalizedCategoryName(item.category, language.code, t) : t('worker.requests.serviceRequest')}
                      tone="brand"
                      icon="briefcase-outline"
                    />
                    {item.createdAt ? <BodySm color={colors.textTertiary}>{formatAppDate(item.createdAt, locale)}</BodySm> : null}
                  </Stack>
                  <StatusBadge status={item.status} />
                </Row>
                <BodySm color={colors.textSecondary}>{item.description}</BodySm>
                <Row gap={spacing.md} wrap>
                  <View style={styles.infoItem}>
                    <InfoRow
                      icon="location-outline"
                      label={t('worker.requests.location')}
                      value={item.address || item.serviceCity || t('requests.location.notProvided')}
                    />
                  </View>
                  <View style={styles.infoItem}>
                    <InfoRow
                      icon="people-outline"
                      label={t('worker.requests.offersReceived')}
                      value={t('offers.count', { count: item.offerCount ?? 0, limit: item.maxOffers ?? 5 })}
                    />
                  </View>
                </Row>
                <MapPreview address={item.address} lat={item.lat} lng={item.lng} />
                <Row gap={spacing.sm} wrap>
                  <Button
                    title={t('common.details')}
                    variant="outline"
                    fullWidth={false}
                    style={styles.requestAction}
                    onPress={() => navigation.navigate('ActiveJob', { requestId: item.id })}
                  />
                  {item.address || (item.lat != null && item.lng != null) ? (
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
                  ) : null}
                </Row>
                <WorkerOfferActionCard
                  request={item}
                  compact
                  myOffer={myOfferFromRequest(item)}
                  offerCount={item.offerCount}
                  maxOffers={item.maxOffers}
                  offersOpen={item.offersOpen}
                  onOpenChat={(offerId) => navigation.navigate('OfferChat', { requestId: item.id, offerId })}
                  onOpenSubscription={() => navigation.navigate('Subscription')}
                  onRefresh={() => {
                    void refetch();
                  }}
                />
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
  listHeader: { marginBottom: spacing.md },
  infoItem: { flexBasis: '48%', flexGrow: 1 },
  requestAction: { flexBasis: '48%', flexGrow: 1 },
  skeleton: { height: 88, borderRadius: 12, backgroundColor: '#E5E7EB' },
});
