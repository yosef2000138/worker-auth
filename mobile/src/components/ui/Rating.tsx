import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '@/i18n';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

export function RatingStars({
  rating,
  count,
  size = 14,
  showValue = true,
  emptyLabel,
}: {
  rating: number;
  count?: number;
  size?: number;
  showValue?: boolean;
  emptyLabel?: string;
}) {
  const { t } = useLanguage();
  const hasReviews = (count ?? 0) > 0 || rating > 0;
  const rounded = Math.round((rating || 0) * 2) / 2;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Ionicons
          key={i}
          name={i <= rounded ? 'star' : 'star-outline'}
          size={size}
          color={colors.brand}
        />
      ))}
      {showValue ? (
        <Text style={{ color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: fontWeight.semibold }}>
          {hasReviews ? `${(rating || 0).toFixed(1)}${count != null ? ` (${count})` : ''}` : emptyLabel ?? t('reviews.newWorker')}
        </Text>
      ) : null}
    </View>
  );
}
