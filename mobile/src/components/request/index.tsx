import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RequestStatus } from '@/types';
import { BodySm, Row, Stack } from '@/components/ui';
import { colors, spacing } from '@/theme';
import { compactStatus } from '@/utils/formatters';

const STEPS: RequestStatus[] = ['PENDING', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED'];

export function RequestStatusTimeline({ status }: { status: RequestStatus }) {
  if (status === 'CANCELLED') {
    return (
      <Row gap={spacing.sm}>
        <Ionicons name="close-circle" size={18} color={colors.danger} />
        <BodySm color={colors.danger} weight="semibold">cancelled</BodySm>
      </Row>
    );
  }

  const activeIndex = Math.max(0, STEPS.indexOf(status));
  return (
    <Stack gap={spacing.sm}>
      {STEPS.map((step, index) => {
        const done = index <= activeIndex;
        return (
          <Row key={step} gap={spacing.sm}>
            <Ionicons
              name={done ? 'checkmark-circle' : 'ellipse-outline'}
              size={18}
              color={done ? colors.success : colors.textTertiary}
            />
            <View style={{ flex: 1 }}>
              <BodySm weight={done ? 'semibold' : 'regular'} color={done ? colors.textPrimary : colors.textSecondary}>
                {compactStatus(step)}
              </BodySm>
            </View>
          </Row>
        );
      })}
    </Stack>
  );
}
