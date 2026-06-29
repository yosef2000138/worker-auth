import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fontSize, fontWeight, radius } from '@/theme';

function badgeLabel(count: number) {
  if (count <= 0) return '';
  return count > 99 ? '99+' : String(count);
}

export function UnreadBadge({ count }: { count: number }) {
  const label = badgeLabel(count);
  if (!label) return null;

  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: 5,
    right: 3,
    minWidth: 18,
    height: 18,
    borderRadius: radius.sm,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: colors.surface,
  },
  badgeText: {
    color: colors.textInverse,
    fontSize: fontSize.xs,
    fontWeight: fontWeight.bold,
    lineHeight: 13,
  },
});
