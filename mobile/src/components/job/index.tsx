import React from 'react';
import {
  Image,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Badge, Body, BodySm, Button, Card, Caption, Divider, H2, H3, Row, Stack } from '@/components/ui';
import { formatAppDate, formatCurrency, getJobStatusLabel, getLocalizedCategoryName, useLanguage } from '@/i18n';
import type { TranslationKey } from '@/i18n';
import { colors, fontSize, fontWeight, radius, spacing } from '@/theme';
import { RequestStatus, ServiceRequest, User, WorkerProfile } from '@/types';

const STATUS_TONE: Record<RequestStatus, 'neutral' | 'brand' | 'success' | 'danger'> = {
  PENDING: 'brand',
  ACCEPTED: 'brand',
  ON_THE_WAY: 'neutral',
  IN_PROGRESS: 'neutral',
  COMPLETED: 'success',
  CANCELLED: 'danger',
};

const STATUS_ICON: Record<RequestStatus, keyof typeof Ionicons.glyphMap> = {
  PENDING: 'time-outline',
  ACCEPTED: 'checkmark-circle-outline',
  ON_THE_WAY: 'navigate-outline',
  IN_PROGRESS: 'construct-outline',
  COMPLETED: 'checkmark-done-circle-outline',
  CANCELLED: 'close-circle-outline',
};

const TIMELINE_STEPS: Array<{ status: RequestStatus; titleKey: TranslationKey; descriptionKey: TranslationKey }> = [
  { status: 'PENDING', titleKey: 'jobs.progress.created', descriptionKey: 'jobs.progress.createdPendingDescription' },
  { status: 'ACCEPTED', titleKey: 'jobs.progress.accepted', descriptionKey: 'jobs.progress.acceptedDescription' },
  { status: 'ON_THE_WAY', titleKey: 'jobs.progress.onTheWay', descriptionKey: 'jobs.progress.onTheWayDescription' },
  { status: 'IN_PROGRESS', titleKey: 'jobs.progress.started', descriptionKey: 'jobs.progress.startedDescription' },
  { status: 'COMPLETED', titleKey: 'jobs.progress.completed', descriptionKey: 'jobs.progress.completedDescription' },
];

type PersonAction = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
};

function isImageObject(image: NonNullable<ServiceRequest['images']>[number]): image is { id: string; imageUrl: string; order?: number } {
  return typeof image === 'object' && image !== null && 'imageUrl' in image;
}

function titleCase(value: string) {
  return value.replace(/\b\w/g, char => char.toUpperCase());
}

export function JobStatusBadge({ status }: { status: RequestStatus }) {
  const { t } = useLanguage();
  return <Badge label={getJobStatusLabel(status, t)} tone={STATUS_TONE[status]} />;
}

export function JobScreenHeader({
  title,
  status,
  onBack,
}: {
  title?: string;
  status: RequestStatus;
  onBack?: () => void;
}) {
  const { isRTL } = useLanguage();
  const { t } = useLanguage();

  return (
    <Row justify="space-between" align="center" style={styles.header}>
      <Row gap={spacing.sm} style={{ flex: 1 }}>
        {onBack ? (
          <Pressable
            onPress={onBack}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel={t('jobs.details.goBack')}
          >
            <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.textPrimary} />
          </Pressable>
        ) : null}
        <H2 style={styles.headerTitle}>{title ?? t('jobs.details.title')}</H2>
      </Row>
      <JobStatusBadge status={status} />
    </Row>
  );
}

export function JobInfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | number | null;
}) {
  if (value == null || value === '') return null;

  return (
    <Row gap={spacing.sm} align="flex-start" style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons name={icon} size={16} color={colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Caption>{label}</Caption>
        <BodySm weight="semibold" color={colors.textPrimary}>{String(value)}</BodySm>
      </View>
    </Row>
  );
}

export function JobSummaryCard({ request }: { request: ServiceRequest }) {
  const { t, locale, language } = useLanguage();
  const price = formatCurrency(request.priceAgreed, locale);
  const paymentMethod = request.paymentMethod ? titleCase(request.paymentMethod.toLowerCase()) : null;
  const categoryName = request.category ? getLocalizedCategoryName(request.category, language.code, t) : '';

  return (
    <Card>
      <Stack gap={spacing.md}>
        <Row justify="space-between" align="flex-start" gap={spacing.md}>
          <Stack gap={spacing.xs} style={{ flex: 1 }}>
            {categoryName ? <Caption>{categoryName}</Caption> : null}
            <H2 style={styles.jobTitle}>{request.title}</H2>
          </Stack>
          <View style={styles.summaryIcon}>
            <Ionicons name={STATUS_ICON[request.status]} size={22} color={colors.textInverse} />
          </View>
        </Row>

        <Divider />

        <View style={styles.summaryGrid}>
          <JobInfoRow icon="calendar-outline" label={t('jobs.details.requested')} value={request.createdAt ? formatAppDate(request.createdAt, locale) : null} />
          <JobInfoRow icon="alarm-outline" label={t('jobs.details.scheduled')} value={request.scheduledAt ? formatAppDate(request.scheduledAt, locale) : null} />
          <JobInfoRow icon="cash-outline" label={t('jobs.details.agreedPrice')} value={price === '-' ? null : price} />
          <JobInfoRow icon="card-outline" label={t('jobs.details.paymentMethod')} value={paymentMethod} />
          <JobInfoRow icon="receipt-outline" label={t('jobs.details.requestId')} value={request.id ? request.id.slice(0, 8) : null} />
        </View>
      </Stack>
    </Card>
  );
}

export function PersonSummaryCard({
  title,
  user,
  worker,
  actions = [],
}: {
  title: string;
  user?: User | null;
  worker?: WorkerProfile | null;
  actions?: PersonAction[];
}) {
  const { isRTL, plural, t } = useLanguage();
  const reviewCount = worker?.totalReviews ?? worker?.ratingCount ?? 0;

  if (!user) return null;

  return (
    <Card>
      <Stack gap={spacing.md}>
        <H3>{title}</H3>
        <Row gap={spacing.md} align="center">
          <Avatar uri={user.avatarUrl} name={user.fullName} size={56} />
          <Stack gap={spacing.xs} style={{ flex: 1 }}>
            <Row gap={spacing.xs} align="center" wrap>
              <Body weight="bold">{user.fullName}</Body>
              {user.isVerified || user.isEmailVerified ? (
                <Ionicons name="shield-checkmark" size={16} color={colors.success} accessibilityLabel={t('jobs.details.verified')} />
              ) : null}
            </Row>
            {reviewCount > 0 && worker?.ratingAvg != null ? (
              <Row gap={spacing.xs}>
                <Ionicons name="star" size={14} color={colors.warning} />
                <BodySm color={colors.textSecondary}>
                  {Number(worker.ratingAvg).toFixed(1)}
                  {` (${plural({
                    zero: 'reviews.count.zero',
                    one: 'reviews.count.one',
                    two: 'reviews.count.two',
                    few: 'reviews.count.few',
                    many: 'reviews.count.many',
                    other: 'reviews.count.other',
                  }, reviewCount)})`}
                </BodySm>
              </Row>
            ) : null}
            {user.phone ? <BodySm color={colors.textSecondary}>{user.phone}</BodySm> : null}
          </Stack>
        </Row>

        {actions.length ? (
          <Row gap={spacing.sm} wrap>
            {actions.map(action => (
              <Pressable
                key={action.label}
                onPress={action.onPress}
                disabled={action.disabled}
                accessibilityRole="button"
                accessibilityLabel={action.accessibilityLabel ?? action.label}
                style={({ pressed }) => [
                  styles.personAction,
                  isRTL && styles.rowReverse,
                  action.primary && styles.personActionPrimary,
                  action.disabled && styles.disabled,
                  pressed && { opacity: 0.78 },
                ]}
              >
                <Ionicons
                  name={action.icon}
                  size={16}
                  color={action.primary ? colors.textInverse : colors.textPrimary}
                />
                <BodySm weight="bold" color={action.primary ? colors.textInverse : colors.textPrimary}>
                  {action.label}
                </BodySm>
              </Pressable>
            ))}
          </Row>
        ) : null}
      </Stack>
    </Card>
  );
}

export function JobLocationCard({
  address,
  lat,
  lng,
  onOpenMap,
  onOpenExternalNavigation,
}: {
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  onOpenMap?: () => void;
  onOpenExternalNavigation?: () => void;
}) {
  const { t } = useLanguage();
  const hasLocation = Boolean(address) || (lat != null && lng != null);
  if (!hasLocation) return null;

  return (
    <Card>
      <Stack gap={spacing.md}>
        <Row justify="space-between" align="center" gap={spacing.md}>
          <H3>{t('jobs.details.location')}</H3>
          {onOpenMap ? (
            <Button
              title={t('jobs.details.viewLocation')}
              variant="outline"
              size="sm"
              fullWidth={false}
              icon={<Ionicons name="map-outline" size={15} color={colors.textPrimary} />}
              onPress={onOpenMap}
              accessibilityLabel={t('jobs.details.openMapA11y')}
            />
          ) : null}
        </Row>

        <View style={styles.mapPanel}>
          <View style={styles.mapRoadA} />
          <View style={styles.mapRoadB} />
          <View style={styles.mapPin}>
            <Ionicons name="location" size={22} color={colors.textInverse} />
          </View>
        </View>

        <Row gap={spacing.sm} align="flex-start">
          <Ionicons name="location-outline" size={18} color={colors.textTertiary} />
          <Stack gap={2} style={{ flex: 1 }}>
            {address ? <Body weight="semibold">{address}</Body> : null}
            {lat != null && lng != null ? (
              <Caption>{lat.toFixed(4)}, {lng.toFixed(4)}</Caption>
            ) : null}
          </Stack>
        </Row>

        {onOpenExternalNavigation ? (
          <Button
            title={t('jobs.details.openExternalNavigation')}
            variant="ghost"
            size="sm"
            icon={<Ionicons name="navigate-outline" size={15} color={colors.textPrimary} />}
            onPress={onOpenExternalNavigation}
            accessibilityLabel={t('jobs.details.openExternalNavigation')}
          />
        ) : null}
      </Stack>
    </Card>
  );
}

export function JobDescriptionCard({
  description,
  images,
}: {
  description?: string | null;
  images?: ServiceRequest['images'];
}) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = React.useState(false);
  const text = description?.trim();
  const imageUrls = (images ?? []).map(image => isImageObject(image) ? image.imageUrl : null).filter(Boolean) as string[];
  if (!text && imageUrls.length === 0) return null;

  const isLong = Boolean(text && text.length > 260);
  const visibleText = isLong && !expanded ? `${text!.slice(0, 260).trim()}...` : text;

  return (
    <Card>
      <Stack gap={spacing.md}>
        <H3>{t('jobs.details.description')}</H3>
        {visibleText ? <Body color={colors.textSecondary}>{visibleText}</Body> : null}
        {isLong ? (
          <Pressable
            onPress={() => setExpanded(current => !current)}
            accessibilityRole="button"
            accessibilityLabel={expanded ? t('jobs.details.showLessA11y') : t('jobs.details.readMoreA11y')}
          >
            <BodySm weight="bold" color={colors.brand}>{expanded ? t('jobs.details.showLess') : t('jobs.details.readMore')}</BodySm>
          </Pressable>
        ) : null}

        {imageUrls.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageRow}>
            {imageUrls.map(uri => (
              <Image key={uri} source={{ uri }} style={styles.jobImage} />
            ))}
          </ScrollView>
        ) : null}
      </Stack>
    </Card>
  );
}

export function JobProgressTimeline({ request }: { request: ServiceRequest }) {
  const { t } = useLanguage();
  if (request.status === 'CANCELLED') {
    return (
      <Card>
        <Stack gap={spacing.md}>
          <H3>{t('jobs.progress.title')}</H3>
          <TimelineRow
            icon="checkmark-circle"
            title={t('jobs.progress.created')}
            description={t('jobs.progress.createdSubmittedDescription')}
            timestamp={request.createdAt}
            state="done"
            showLine
          />
          <TimelineRow
            icon="close-circle"
            title={t('jobs.progress.cancelled')}
            description={t('jobs.progress.cancelledDescription')}
            timestamp={request.updatedAt}
            state="danger"
          />
        </Stack>
      </Card>
    );
  }

  const currentIndex = Math.max(0, TIMELINE_STEPS.findIndex(step => step.status === request.status));

  return (
    <Card>
      <Stack gap={spacing.md}>
        <H3>{t('jobs.progress.title')}</H3>
        <Stack gap={0}>
          {TIMELINE_STEPS.map((step, index) => {
            const done = index < currentIndex;
            const current = index === currentIndex;
            const timestamp = step.status === 'PENDING'
              ? request.createdAt
              : current
              ? request.updatedAt
              : undefined;

            return (
              <TimelineRow
                key={step.status}
                icon={done ? 'checkmark-circle' : current ? STATUS_ICON[step.status] : 'ellipse-outline'}
                title={t(step.titleKey)}
                description={t(step.descriptionKey)}
                timestamp={timestamp}
                state={done ? 'done' : current ? 'current' : 'future'}
                showLine={index < TIMELINE_STEPS.length - 1}
              />
            );
          })}
        </Stack>
      </Stack>
    </Card>
  );
}

function TimelineRow({
  icon,
  title,
  description,
  timestamp,
  state,
  showLine,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
  timestamp?: string | null;
  state: 'done' | 'current' | 'future' | 'danger';
  showLine?: boolean;
}) {
  const { locale } = useLanguage();
  const color = state === 'danger'
    ? colors.danger
    : state === 'done'
    ? colors.success
    : state === 'current'
    ? colors.brand
    : colors.textTertiary;

  return (
    <Row gap={spacing.md} align="flex-start">
      <View style={styles.timelineRail}>
        <Ionicons name={icon} size={22} color={color} />
        {showLine ? <View style={[styles.timelineLine, { backgroundColor: state === 'future' ? colors.border : color }]} /> : null}
      </View>
      <View style={styles.timelineContent}>
        <BodySm weight="bold" color={state === 'future' ? colors.textSecondary : colors.textPrimary}>{title}</BodySm>
        <Caption>{description}</Caption>
        {timestamp ? <Caption color={colors.textSecondary}>{formatAppDate(timestamp, locale)}</Caption> : null}
      </View>
    </Row>
  );
}

export function JobPaymentCard({ request, label }: { request: ServiceRequest; label?: string }) {
  const { t, locale } = useLanguage();
  const amount = formatCurrency(request.priceAgreed, locale);
  const paymentMethod = request.paymentMethod ? titleCase(request.paymentMethod.toLowerCase()) : null;
  const hasPaymentInfo = amount !== '-' || Boolean(request.paymentMethod);
  if (!hasPaymentInfo) return null;

  return (
    <Card>
      <Stack gap={spacing.md}>
        <H3>{label ?? t('jobs.payment.title')}</H3>
        {amount !== '-' ? (
          <Row justify="space-between">
            <BodySm color={colors.textSecondary}>{t('jobs.details.agreedPrice')}</BodySm>
            <Body weight="bold" color={colors.success}>{amount}</Body>
          </Row>
        ) : null}
        {request.paymentMethod ? (
          <Row justify="space-between">
            <BodySm color={colors.textSecondary}>{t('jobs.details.paymentMethod')}</BodySm>
            <BodySm weight="bold">{paymentMethod}</BodySm>
          </Row>
        ) : null}
      </Stack>
    </Card>
  );
}

export function JobTerminalStateCard({ request }: { request: ServiceRequest }) {
  const { t, locale } = useLanguage();
  if (request.status !== 'COMPLETED' && request.status !== 'CANCELLED') return null;

  const completed = request.status === 'COMPLETED';
  return (
    <Card style={completed ? styles.completedCard : styles.cancelledCard}>
      <Row gap={spacing.md} align="flex-start">
        <View style={[styles.terminalIcon, { backgroundColor: completed ? colors.success : colors.danger }]}>
          <Ionicons name={completed ? 'checkmark-done' : 'close'} size={20} color={colors.textInverse} />
        </View>
        <Stack gap={spacing.xs} style={{ flex: 1 }}>
          <H3>{completed ? t('jobs.progress.completed') : t('jobs.progress.cancelled')}</H3>
          <BodySm color={colors.textSecondary}>
            {completed ? t('jobs.progress.completedTerminal') : t('jobs.progress.cancelledDescription')}
          </BodySm>
          {request.updatedAt ? <Caption>{formatAppDate(request.updatedAt, locale)}</Caption> : null}
        </Stack>
      </Row>
    </Card>
  );
}

export function JobLoadingSkeleton() {
  return (
    <Stack gap={spacing.md}>
      <View style={[styles.skeleton, { height: 96 }]} />
      <View style={[styles.skeleton, { height: 150 }]} />
      <View style={[styles.skeleton, { height: 210 }]} />
      <View style={[styles.skeleton, { height: 88 }]} />
    </Stack>
  );
}

export function openPhone(phone?: string | null) {
  if (!phone) return;
  void Linking.openURL(`tel:${phone}`);
}

export function openExternalNavigation({
  address,
  lat,
  lng,
}: {
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
}) {
  const query = lat != null && lng != null ? `${lat},${lng}` : address ?? '';
  if (!query) return;

  const encoded = encodeURIComponent(query);
  const url = lat != null && lng != null
    ? Platform.select({
      ios: `http://maps.apple.com/?ll=${lat},${lng}`,
      android: `geo:${lat},${lng}?q=${encoded}`,
      default: `https://www.google.com/maps/search/?api=1&query=${encoded}`,
    })
    : `https://www.google.com/maps/search/?api=1&query=${encoded}`;

  if (url) void Linking.openURL(url);
}

const styles = StyleSheet.create({
  header: { minHeight: 48 },
  rowReverse: { flexDirection: 'row-reverse' },
  headerTitle: { flexShrink: 1 },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jobTitle: { fontSize: fontSize.xl, lineHeight: 28 },
  summaryIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryGrid: { gap: spacing.md },
  infoRow: { minHeight: 42 },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.brandSoftest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  personAction: {
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
    backgroundColor: colors.surface,
  },
  personActionPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  disabled: { opacity: 0.45 },
  mapPanel: {
    height: 132,
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: '#E0F2FE',
    borderWidth: 1,
    borderColor: colors.border,
  },
  mapRoadA: {
    position: 'absolute',
    width: 280,
    height: 18,
    left: -42,
    top: 34,
    backgroundColor: colors.surface,
    opacity: 0.84,
    transform: [{ rotate: '-12deg' }],
  },
  mapRoadB: {
    position: 'absolute',
    width: 18,
    height: 180,
    left: 106,
    top: -22,
    backgroundColor: colors.surface,
    opacity: 0.78,
    transform: [{ rotate: '20deg' }],
  },
  mapPin: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: 42,
    height: 42,
    marginLeft: -21,
    marginTop: -21,
    borderRadius: 21,
    backgroundColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.surface,
  },
  imageRow: { gap: spacing.sm },
  jobImage: {
    width: 112,
    height: 92,
    borderRadius: radius.md,
    backgroundColor: colors.ink300,
  },
  timelineRail: { alignItems: 'center', width: 26 },
  timelineLine: { width: 2, minHeight: 44, marginTop: spacing.xs, borderRadius: 1 },
  timelineContent: { flex: 1, paddingBottom: spacing.md, gap: 2 },
  completedCard: { borderColor: colors.successSoft, backgroundColor: '#F8FFF9' },
  cancelledCard: { borderColor: colors.dangerSoft, backgroundColor: '#FFF8F8' },
  terminalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skeleton: { borderRadius: radius.lg, backgroundColor: '#E5E7EB' },
});
