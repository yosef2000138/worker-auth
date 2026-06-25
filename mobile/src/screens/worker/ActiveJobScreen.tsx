import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RequestStatus, RootStackParamList } from '@/types';
import { requestService } from '@/services/requestService';
import { MapPreview } from '@/components/map';
import { RequestStatusTimeline } from '@/components/request';
import { Banner, Body, BodySm, Button, Card, ErrorState, H2, H3, ListSkeleton, Row, Stack, StatusBadge } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { formatDate } from '@/utils/formatters';
type Props = NativeStackScreenProps<RootStackParamList, 'ActiveJob'>;

const NEXT_STATUS: Partial<Record<RequestStatus, RequestStatus>> = {
  PENDING: 'ACCEPTED',
  ACCEPTED: 'ON_THE_WAY',
  ON_THE_WAY: 'IN_PROGRESS',
  IN_PROGRESS: 'COMPLETED',
};

const ACTION_LABEL: Partial<Record<RequestStatus, string>> = {
  PENDING: 'Accept job',
  ACCEPTED: 'Mark on the way',
  ON_THE_WAY: 'Start job',
  IN_PROGRESS: 'Complete job',
};

export default function ActiveJobScreen({ route, navigation }: Props) {
  const queryClient = useQueryClient();
  const requestId = route.params?.requestId;
  const listQuery = useQuery({
    queryKey: ['worker-active-fallback'],
    queryFn: () => requestService.list({ limit: 20 }),
    enabled: !requestId,
  });
  const fallbackItems = Array.isArray(listQuery.data) ? listQuery.data : listQuery.data?.items ?? listQuery.data?.data ?? [];
  const fallbackRequest = fallbackItems.find(item => ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS'].includes(item.status)) ?? fallbackItems[0];
  const effectiveId = requestId ?? fallbackRequest?.id;

  const { data: request, isLoading, isError, refetch } = useQuery({
    queryKey: ['request', effectiveId],
    queryFn: () => requestService.getOne(effectiveId!),
    enabled: !!effectiveId,
  });

  const advance = useMutation({
    mutationFn: (status: RequestStatus) => requestService.updateStatus(effectiveId!, status as Exclude<RequestStatus, 'PENDING'>),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['request', effectiveId] });
      queryClient.invalidateQueries({ queryKey: ['worker-requests'] });
      queryClient.invalidateQueries({ queryKey: ['incoming'] });
    },
  });

  if (listQuery.isLoading || isLoading) return <ScrollView style={{ padding: spacing.lg }}><ListSkeleton count={3} /></ScrollView>;
  if (!effectiveId) return <ErrorState message="No active job selected." />;
  if (isError || !request) return <ErrorState onRetry={refetch} />;

  const next = NEXT_STATUS[request.status];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Card>
        <Row justify="space-between" align="flex-start">
          <Stack gap={spacing.xs} style={{ flex: 1 }}>
            <H2>{request.title}</H2>
            <BodySm color={colors.textSecondary}>{request.category?.name}</BodySm>
          </Stack>
          <StatusBadge status={request.status} />
        </Row>
        <Body color={colors.textSecondary} style={{ marginTop: spacing.md }}>{request.description}</Body>
        {request.createdAt ? <BodySm color={colors.textTertiary} style={{ marginTop: spacing.sm }}>Created {formatDate(request.createdAt)}</BodySm> : null}
      </Card>

      <View style={{ marginTop: spacing.md }}>
        <MapPreview address={request.address} lat={request.lat} lng={request.lng} />
      </View>

      <Card style={{ marginTop: spacing.md }}>
        <H3 style={{ marginBottom: spacing.md }}>Progress</H3>
        <RequestStatusTimeline status={request.status} />
      </Card>

      {advance.isError ? <Banner tone="danger" message={advance.error?.message ?? 'Could not update job.'} /> : null}

      <Stack gap={spacing.sm} style={{ marginTop: spacing.lg }}>
        {next ? (
          <Button
            title={ACTION_LABEL[request.status] ?? 'Update job'}
            loading={advance.isPending}
            onPress={() => advance.mutate(next)}
          />
        ) : null}
        {request.worker && request.status !== 'PENDING' ? (
          <Button
            title="Open chat"
            variant="outline"
            onPress={() => navigation.navigate('Chat', { requestId: effectiveId })}
          />
        ) : null}
        {['ACCEPTED', 'ON_THE_WAY'].includes(request.status) ? (
          <Button
            title="Cancel job"
            variant="danger"
            loading={advance.isPending}
            onPress={() => advance.mutate('CANCELLED')}
          />
        ) : null}
      </Stack>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'] },
});
