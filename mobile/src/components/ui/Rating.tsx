import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, fontSize, fontWeight, spacing } from '@/theme';

export function RatingStars({
  rating,
  count,
  size = 14,
  showValue = true,
}: {
  rating: number;
  count?: number;
  size?: number;
  showValue?: boolean;
}) {
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
          {(rating || 0).toFixed(1)}{count != null ? ` (${count})` : ''}
        </Text>
      ) : null}
    </View>
  );
}
