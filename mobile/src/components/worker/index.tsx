import React from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WorkerProfile } from '@/types';
import { Avatar, Badge, Body, BodySm, Card, Row, Stack } from '@/components/ui';
import { RatingStars } from '@/components/ui/Rating';
import { formatCurrency, useLanguage } from '@/i18n';
import { colors, spacing } from '@/theme';

export function WorkerCard({
  worker,
  isFavorite,
  onToggleFavorite,
  onPress,
}: {
  worker: WorkerProfile;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  onPress?: () => void;
}) {
  const { t, locale } = useLanguage();
  const name = worker.user?.fullName ?? t('common.workerRole');
  const price = worker.hourlyRate != null
    ? `${formatCurrency(worker.hourlyRate, locale)}/${t('common.hoursShort')}`
    : worker.fixedPrice != null
    ? `${formatCurrency(worker.fixedPrice, locale)} ${t('common.fixed')}`
    : null;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed ? { opacity: 0.78 } : undefined}>
      <Card>
        <Row gap={spacing.md} align="flex-start">
          <Avatar uri={worker.user?.avatarUrl} name={name} size={52} />
          <Stack gap={spacing.xs} style={{ flex: 1 }}>
            <Row justify="space-between" align="flex-start">
              <Body weight="bold" style={{ flex: 1 }}>{name}</Body>
              {onToggleFavorite ? (
                <Ionicons
                  name={isFavorite ? 'heart' : 'heart-outline'}
                  size={20}
                  color={isFavorite ? colors.danger : colors.textTertiary}
                  onPress={onToggleFavorite}
                  suppressHighlighting
                />
              ) : null}
            </Row>
            <RatingStars rating={worker.ratingAvg ?? 0} count={worker.totalReviews ?? worker.ratingCount ?? 0} />
            {worker.bio ? <BodySm color={colors.textSecondary} numberOfLines={2}>{worker.bio}</BodySm> : null}
            <Row gap={spacing.sm} wrap>
              {worker.isAvailable ? <Badge label={t('common.available')} tone="success" /> : <Badge label={t('common.unavailable')} />}
              {price ? <Badge label={price} tone="brand" /> : null}
            </Row>
          </Stack>
        </Row>
      </Card>
    </Pressable>
  );
}
