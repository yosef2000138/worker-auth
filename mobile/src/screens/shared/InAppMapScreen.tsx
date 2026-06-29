import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MessagesHeaderButton } from '@/components/messages/MessagesHeaderButton';
import { Banner, Body, BodySm, Button, Card, Caption, H2, H3, Row, Stack } from '@/components/ui';
import { openExternalNavigation } from '@/components/job';
import { useLocation } from '@/hooks/useLocation';
import { useLanguage } from '@/i18n';
import { colors, radius, spacing } from '@/theme';
import { RootStackParamList } from '@/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Map'>;
type Coords = { lat: number; lng: number };

function getDestination(params: RootStackParamList['Map']): Coords | null {
  if (params?.lat == null || params?.lng == null) return null;
  return { lat: Number(params.lat), lng: Number(params.lng) };
}

function formatCoords(coords: Coords) {
  return `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
}

function MapMarker({
  icon,
  label,
  tone,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tone: 'destination' | 'current';
  style: object;
}) {
  return (
    <View style={[styles.markerWrap, style]}>
      <View style={[styles.marker, tone === 'current' ? styles.currentMarker : styles.destinationMarker]}>
        <Ionicons name={icon} size={20} color={colors.textInverse} />
      </View>
      <View style={styles.markerLabel}>
        <BodySm weight="bold">{label}</BodySm>
      </View>
    </View>
  );
}

export default function InAppMapScreen({ navigation, route }: Props) {
  const { t, isRTL } = useLanguage();
  const insets = useSafeAreaInsets();
  const { location, requestLocation } = useLocation();
  const [locating, setLocating] = React.useState(false);
  const [locationError, setLocationError] = React.useState<string | null>(null);

  const params = route.params;
  const destination = getDestination(params);
  const current = location
    ? { lat: location.coords.latitude, lng: location.coords.longitude }
    : null;
  const hasSummary = Boolean(destination || current || params?.address);
  const canOpenExternal = Boolean(destination || params?.address);

  const refreshLocation = React.useCallback(async () => {
    setLocating(true);
    setLocationError(null);
    try {
      const currentLocation = await requestLocation();
      if (!currentLocation) {
        setLocationError(t('map.currentUnavailable'));
      }
    } catch (error) {
      setLocationError(error instanceof Error ? error.message : t('map.currentError'));
    } finally {
      setLocating(false);
    }
  }, [requestLocation, t]);

  React.useEffect(() => {
    void refreshLocation();
  }, []);

  return (
    <View style={styles.root}>
      <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
        <Pressable
          onPress={() => navigation.goBack()}
          accessibilityRole="button"
          accessibilityLabel={t('map.goBack')}
          style={({ pressed }) => [styles.iconButton, pressed && { opacity: 0.72 }]}
        >
          <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.textPrimary} />
        </Pressable>
        <View style={styles.topTitle}>
          <H2 numberOfLines={1}>{params?.title ?? t('common.map')}</H2>
          {params?.requestId ? <Caption>{t('map.requestShort', { id: params.requestId.slice(0, 8) })}</Caption> : null}
        </View>
        <MessagesHeaderButton />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 84, paddingBottom: insets.bottom + spacing['4xl'] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {locationError ? <Banner tone="warning" message={locationError} /> : null}

        <Card>
          <Stack gap={spacing.md}>
            <View style={styles.mapSurface}>
              <View style={styles.gridLineA} />
              <View style={styles.gridLineB} />
              <View style={styles.gridLineC} />
              <View style={styles.gridLineD} />

              {destination ? (
                <MapMarker
                  icon="location"
                  label={t('map.jobMarker')}
                  tone="destination"
                  style={styles.destinationMarkerPosition}
                />
              ) : null}

              {current ? (
                <MapMarker
                  icon="navigate"
                  label={t('map.youMarker')}
                  tone="current"
                  style={destination ? styles.currentMarkerPosition : styles.centerMarkerPosition}
                />
              ) : null}

              {!destination && !current ? (
                <View style={styles.mapEmpty}>
                  {locating ? <ActivityIndicator color={colors.brand} /> : <Ionicons name="map-outline" size={34} color={colors.textTertiary} />}
                  <BodySm center color={colors.textSecondary}>
                    {locating ? t('map.findingLocation') : t('map.noLocation')}
                  </BodySm>
                </View>
              ) : null}

              <Pressable
                onPress={refreshLocation}
                disabled={locating}
                accessibilityRole="button"
                accessibilityLabel={t('map.recenterA11y')}
                style={({ pressed }) => [styles.recenterButton, pressed && { opacity: 0.76 }]}
              >
                {locating ? (
                  <ActivityIndicator color={colors.textPrimary} />
                ) : (
                  <Ionicons name="locate-outline" size={21} color={colors.textPrimary} />
                )}
              </Pressable>
            </View>

            <Stack gap={spacing.sm}>
              <H3>{t('map.locationDetails')}</H3>
              {!hasSummary ? (
                <BodySm color={colors.textSecondary}>{t('map.openJobWithCoordinates')}</BodySm>
              ) : null}
              {params?.address ? (
                <Row gap={spacing.sm} align="flex-start">
                  <Ionicons name="location-outline" size={18} color={colors.textTertiary} />
                  <Body style={{ flex: 1 }}>{params.address}</Body>
                </Row>
              ) : null}
              {destination ? (
                <Row justify="space-between">
                  <BodySm color={colors.textSecondary}>{t('map.jobCoordinates')}</BodySm>
                  <BodySm weight="bold">{formatCoords(destination)}</BodySm>
                </Row>
              ) : null}
              {current ? (
                <Row justify="space-between">
                  <BodySm color={colors.textSecondary}>{t('map.currentLocation')}</BodySm>
                  <BodySm weight="bold">{formatCoords(current)}</BodySm>
                </Row>
              ) : null}
            </Stack>

            <Row gap={spacing.sm} wrap>
              <Button
                title={t('map.recenter')}
                variant="outline"
                fullWidth={false}
                style={styles.actionButton}
                loading={locating}
                onPress={refreshLocation}
              />
              {canOpenExternal ? (
                <Button
                  title={t('map.openExternalNavigation')}
                  variant="ghost"
                  fullWidth={false}
                  style={styles.actionButton}
                  onPress={() => openExternalNavigation({
                    address: params?.address,
                    lat: params?.lat,
                    lng: params?.lng,
                  })}
                />
              ) : null}
            </Row>
          </Stack>
        </Card>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    position: 'absolute',
    zIndex: 10,
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topTitle: { flex: 1 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  scroll: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  mapSurface: {
    height: 360,
    borderRadius: radius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#DBEAFE',
  },
  gridLineA: {
    position: 'absolute',
    width: 440,
    height: 22,
    top: 72,
    left: -64,
    backgroundColor: colors.surface,
    opacity: 0.86,
    transform: [{ rotate: '-12deg' }],
  },
  gridLineB: {
    position: 'absolute',
    width: 22,
    height: 460,
    top: -40,
    left: '36%',
    backgroundColor: colors.surface,
    opacity: 0.8,
    transform: [{ rotate: '18deg' }],
  },
  gridLineC: {
    position: 'absolute',
    width: 420,
    height: 16,
    bottom: 96,
    left: -44,
    backgroundColor: '#BFDBFE',
    opacity: 0.92,
    transform: [{ rotate: '9deg' }],
  },
  gridLineD: {
    position: 'absolute',
    width: 18,
    height: 420,
    top: -20,
    right: '24%',
    backgroundColor: '#EFF6FF',
    opacity: 0.9,
    transform: [{ rotate: '-8deg' }],
  },
  markerWrap: { position: 'absolute', alignItems: 'center', gap: spacing.xs },
  destinationMarkerPosition: { left: '50%', top: '47%', transform: [{ translateX: -31 }, { translateY: -31 }] },
  currentMarkerPosition: { left: '28%', top: '63%', transform: [{ translateX: -31 }, { translateY: -31 }] },
  centerMarkerPosition: { left: '50%', top: '50%', transform: [{ translateX: -31 }, { translateY: -31 }] },
  marker: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
  },
  destinationMarker: { backgroundColor: colors.danger },
  currentMarker: { backgroundColor: colors.brand },
  markerLabel: {
    minHeight: 28,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapEmpty: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.sm,
  },
  recenterButton: {
    position: 'absolute',
    right: spacing.md,
    bottom: spacing.md,
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButton: { flexBasis: '47%', flexGrow: 1 },
});
