import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types';
import { requestService } from '@/services/requestService';
import { paymentService } from '@/services/paymentService';
import { reviewService } from '@/services/reviewService';
import { useAuthStore } from '@/store/authStore';
import {
  Stack, Row, Card, Avatar, Button, H2, H3, Body, BodySm, Caption,
  Banner, Divider, ErrorState, ListSkeleton, StatusBadge,
} from '@/components/ui';
import { RequestStatusTimeline } from '@/components/request';
import { colors, spacing } from '@/theme';
import { formatDate, formatMoney } from '@/utils/formatters';

type Props = NativeStackScreenProps<RootStackParamList, 'RequestDetails'>;

export default function RequestDetailsScreen({ route, navigation }: Props) {
  const { requestId } = route.params;
  const user = useAuthStore(s => s.user);
  const queryClient = useQueryClient();

  const { data: req, isLoading, isError, refetch } = useQuery({
    queryKey: ['request', requestId],
    queryFn: () => requestService.getOne(requestId),
  });

  const { data: payment } = useQuery({
    queryKey: ['payment', requestId],
    queryFn: () => paymentService.byRequest(requestId),
    enabled: req?.status === 'COMPLETED',
  });

  const cancel = useMutation({
    mutationFn: () => requestService.cancel(requestId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['request', requestId] }); refetch(); },
  });

  const [showReview, setShowReview] = React.useState(false);
  const [rating, setRating] = React.useState(5);
  const [comment, setReviewComment] = React.useState('');
  const submitReview = useMutation({
    mutationFn: () => reviewService.create({ requestId, rating, comment }),
    onSuccess: () => { setShowReview(false); queryClient.invalidateQueries({ queryKey: ['request', requestId] }); },
  });

  if (isLoading) return <View style={{ padding: spacing.lg }}><ListSkeleton count={2} /></View>;
  if (isError || !req) return <ErrorState onRetry={refetch} />;

  const canCancel = ['PENDING', 'ACCEPTED'].includes(req.status);
  const canReview = req.status === 'COMPLETED' && !payment;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <Card>
        <Row justify="space-between" align="flex-start">
          <Stack gap={4} style={{ flex: 1 }}>
            <H2 style={{ flex: 1 }}>{req.title}</H2>
            {req.category?.name ? <Caption>{req.category.name}</Caption> : null}
          </Stack>
          <StatusBadge status={req.status} />
        </Row>
        <Divider style={{ marginVertical: spacing.md }} />
        <Body color={colors.textSecondary}>{req.description}</Body>
        <Divider style={{ marginVertical: spacing.md }} />
        <Stack gap={spacing.sm}>
          {req.address ? (
            <Row gap={spacing.sm}>
              <Ionicons name="location-outline" size={16} color={colors.textTertiary} />
              <BodySm color={colors.textSecondary}>{req.address}</BodySm>
            </Row>
          ) : null}
          {req.scheduledAt ? (
            <Row gap={spacing.sm}>
              <Ionicons name="calendar-outline" size={16} color={colors.textTertiary} />
              <BodySm color={colors.textSecondary}>Scheduled: {formatDate(req.scheduledAt)}</BodySm>
            </Row>
          ) : null}
          {req.paymentMethod ? (
            <Row gap={spacing.sm}>
              <Ionicons name="card-outline" size={16} color={colors.textTertiary} />
              <BodySm color={colors.textSecondary}>Payment: {req.paymentMethod}</BodySm>
            </Row>
          ) : null}
          <Row gap={spacing.sm}>
            <Ionicons name="time-outline" size={16} color={colors.textTertiary} />
            <BodySm color={colors.textSecondary}>Created {formatDate(req.createdAt)}</BodySm>
          </Row>
        </Stack>
      </Card>

      {/* Assigned worker */}
      {req.worker ? (
        <Card style={{ marginTop: spacing.md }}>
          <H3 style={{ marginBottom: spacing.md }}>Your worker</H3>
          <Row gap={spacing.md}>
            <Avatar uri={req.worker.user?.avatarUrl} name={req.worker.user?.fullName} size={48} />
            <Stack gap={4} style={{ flex: 1 }}>
              <Body weight="semibold">{req.worker.user?.fullName}</Body>
              {req.worker.ratingAvg != null ? (
                <Row gap={spacing.xs}>
                  <Ionicons name="star" size={13} color={colors.brand} />
                  <BodySm>{req.worker.ratingAvg.toFixed(1)}</BodySm>
                </Row>
              ) : null}
            </Stack>
            <Button
              title="View profile"
              variant="outline"
              size="sm"
              fullWidth={false}
              onPress={() => navigation.navigate('WorkerProfile', { workerId: req.worker!.id })}
            />
          </Row>
        </Card>
      ) : null}

      {/* Status timeline */}
      <Card style={{ marginTop: spacing.md }}>
        <H3 style={{ marginBottom: spacing.md }}>Job progress</H3>
        <RequestStatusTimeline status={req.status} />
      </Card>

      {/* Payment */}
      {payment ? (
        <Card style={{ marginTop: spacing.md }}>
          <H3 style={{ marginBottom: spacing.sm }}>Payment</H3>
          <Row justify="space-between">
            <BodySm color={colors.textSecondary}>Amount paid</BodySm>
            <Body weight="bold" color={colors.success}>{formatMoney(payment.amount)}</Body>
          </Row>
        </Card>
      ) : null}

      {/* Review form */}
      {canReview && !showReview ? (
        <Card style={{ marginTop: spacing.md }}>
          <H3>Leave a review</H3>
          <BodySm color={colors.textSecondary} style={{ marginTop: 4 }}>
            How was your experience with this worker?
          </BodySm>
          <Button title="Write a review" variant="outline" size="sm" style={{ marginTop: spacing.md }} onPress={() => setShowReview(true)} />
        </Card>
      ) : null}

      {showReview ? (
        <Card style={{ marginTop: spacing.md }}>
          <H3>Your review</H3>
          {submitReview.isError ? <Banner tone="danger" message={submitReview.error?.message ?? 'Could not submit review.'} /> : null}
          <Row gap={spacing.sm} style={{ marginVertical: spacing.md }}>
            {[1, 2, 3, 4, 5].map(i => (
              <Ionicons
                key={i}
                name={i <= rating ? 'star' : 'star-outline'}
                size={28}
                color={colors.brand}
                onPress={() => setRating(i)}
                suppressHighlighting
              />
            ))}
          </Row>
          <Stack gap={spacing.sm}>
            <Button title="Submit review" loading={submitReview.isPending} onPress={() => submitReview.mutate()} />
            <Button title="Cancel" variant="ghost" onPress={() => setShowReview(false)} />
          </Stack>
        </Card>
      ) : null}

      {/* Actions */}
      <Stack gap={spacing.sm} style={{ marginTop: spacing.lg }}>
        {req.worker ? (
          <Button
            title="Open chat"
            icon={<Ionicons name="chatbubble-outline" size={16} color={colors.textInverse} />}
            onPress={() => navigation.navigate('Chat', { requestId })}
          />
        ) : (
          <BodySm color={colors.textSecondary}>Chat opens after a worker accepts this request.</BodySm>
        )}
        {canCancel ? (
          <Button
            title={cancel.isPending ? 'Cancelling…' : 'Cancel request'}
            variant="danger"
            loading={cancel.isPending}
            onPress={() => cancel.mutate()}
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
