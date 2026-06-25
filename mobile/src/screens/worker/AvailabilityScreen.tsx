import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { workerService } from '@/services/workerService';
import { Banner, Body, BodySm, Button, Card, H2, ListSkeleton, Row, Screen, Stack } from '@/components/ui';
import { colors, spacing } from '@/theme';

export default function AvailabilityScreen() {
  const queryClient = useQueryClient();
  const { data: worker, isLoading } = useQuery({ queryKey: ['worker-me'], queryFn: workerService.me });
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    if (worker?.isAvailable != null) setAvailable(worker.isAvailable);
  }, [worker?.isAvailable]);

  const mutation = useMutation({
    mutationFn: () => workerService.toggleAvailability(available),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['worker-me'] }),
  });

  if (isLoading) return <Screen><ListSkeleton count={3} /></Screen>;

  return (
    <Screen>
      <H2>Availability</H2>
      {mutation.isError ? <Banner tone="danger" message={mutation.error?.message ?? 'Could not save availability.'} /> : null}
      {mutation.isSuccess ? <Banner tone="success" message="Availability saved." /> : null}
      <Card>
        <Row justify="space-between">
          <Stack gap={spacing.xs} style={{ flex: 1 }}>
            <Body weight="bold">{available ? 'Available for new jobs' : 'Not taking jobs'}</Body>
            <BodySm color={colors.textSecondary}>Customers can find you only while available.</BodySm>
          </Stack>
          <Switch value={available} onValueChange={setAvailable} />
        </Row>
      </Card>
      <Card>
        <Stack gap={spacing.sm}>
          <Body weight="bold">Current schedule</Body>
          {(worker?.availability ?? []).length === 0 ? (
            <BodySm color={colors.textSecondary}>No schedule set yet.</BodySm>
          ) : worker!.availability!.map(slot => (
            <Row key={slot.id ?? `${slot.dayOfWeek}-${slot.startTime}`} justify="space-between">
              <BodySm>Day {slot.dayOfWeek}</BodySm>
              <BodySm color={colors.textSecondary}>{slot.startTime} - {slot.endTime}</BodySm>
            </Row>
          ))}
        </Stack>
      </Card>
      <Button title="Save to backend" loading={mutation.isPending} onPress={() => mutation.mutate()} />
    </Screen>
  );
}

StyleSheet.create({});
