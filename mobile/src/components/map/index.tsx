import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BodySm, Card, Row, Stack } from '@/components/ui';
import { colors, fontWeight, spacing } from '@/theme';
import { useLanguage } from '@/i18n';

export function MapPreview({
  address,
  lat,
  lng,
}: {
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}) {
  const { t } = useLanguage();
  const hasCoordinates = lat != null && lng != null;
  const hasLocation = Boolean(address) || hasCoordinates;

  return (
    <Card>
      <Stack gap={spacing.md}>
        <View style={styles.map}>
          <View style={styles.gridLineA} />
          <View style={styles.gridLineB} />
          <View style={styles.gridLineC} />
          <View style={styles.pin}>
            <Ionicons name="location" size={24} color={colors.textInverse} />
          </View>
        </View>
        <Row gap={spacing.sm} align="flex-start">
          <Ionicons name="navigate-outline" size={17} color={colors.textTertiary} />
          <Stack gap={2} style={{ flex: 1 }}>
            <Text style={styles.address}>{hasLocation ? address ?? t('requests.location.currentLocation') : t('requests.location.notProvided')}</Text>
            {hasCoordinates ? (
              <BodySm color={colors.textSecondary}>{lat.toFixed(4)}, {lng.toFixed(4)}</BodySm>
            ) : null}
          </Stack>
        </Row>
      </Stack>
    </Card>
  );
}

export function PlaceholderCard({ title }: { title: string }) {
  return <MapPreview address={title} />;
}

const styles = StyleSheet.create({
  map: {
    height: 150,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#DCEAFE',
    borderWidth: 1,
    borderColor: colors.border,
  },
  gridLineA: { position: 'absolute', width: 260, height: 16, backgroundColor: '#FFFFFF', opacity: 0.7, top: 38, left: -30, transform: [{ rotate: '-12deg' }] },
  gridLineB: { position: 'absolute', width: 18, height: 220, backgroundColor: '#FFFFFF', opacity: 0.75, top: -30, left: 96, transform: [{ rotate: '18deg' }] },
  gridLineC: { position: 'absolute', width: 260, height: 12, backgroundColor: '#BFDBFE', opacity: 0.9, top: 108, left: -40, transform: [{ rotate: '8deg' }] },
  pin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 44,
    height: 44,
    marginLeft: -22,
    marginTop: -22,
    borderRadius: 22,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
  },
  address: { color: colors.textPrimary, fontWeight: fontWeight.semibold, fontSize: 14 },
});
