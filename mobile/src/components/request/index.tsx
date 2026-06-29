import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { getRequestStatusLabel, useLanguage } from '@/i18n';
import { RequestStatus } from '@/types';
import { BodySm, Row, Stack } from '@/components/ui';
import { colors, spacing } from '@/theme';

const STEPS: RequestStatus[] = ['PENDING', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED'];

export function RequestStatusTimeline({ status }: { status: RequestStatus }) {
  const { t } = useLanguage();

  if (status === 'CANCELLED') {
    return (
      <Row gap={spacing.sm}>
        <Ionicons name="close-circle" size={18} color={colors.danger} />
        <BodySm color={colors.danger} weight="semibold">{getRequestStatusLabel('CANCELLED', t)}</BodySm>
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
                {getRequestStatusLabel(step, t)}
              </BodySm>
            </View>
          </Row>
        );
      })}
    </Stack>
  );
}
