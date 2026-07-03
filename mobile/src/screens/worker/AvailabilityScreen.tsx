import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery } from '@tanstack/react-query';

import { requestService } from '@/services/requestService';
import { ApiRequestError } from '@/services/api';
import { useAuthStore } from '@/store/authStore';
import { Paginated, RequestStatus, RootStackParamList, ServiceRequest } from '@/types';
import { Badge, Body, BodySm, Button, Card, EmptyState, ErrorState, H2, H3, ListSkeleton, Row, Screen, Stack, StatusBadge } from '@/components/ui';
import { colors, fontSize, radius, spacing } from '@/theme';
import { formatAppDate, formatAppTime, getLocalizedCategoryName, useLanguage } from '@/i18n';
import { queryKeys } from '@/utils/queryKeys';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const SCHEDULED_STATUSES: RequestStatus[] = ['ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS', 'COMPLETED'];
const REQUEST_PAGE_LIMIT = 50;

function getItems(data?: Paginated<ServiceRequest>) {
  return Array.isArray(data) ? data : data?.items ?? data?.data ?? [];
}

function getTotalPages(data?: Paginated<ServiceRequest>) {
  if (!data || Array.isArray(data)) return 1;
  return data.pagination?.pages ?? data.pages ?? 1;
}

async function fetchStatusPages(status: RequestStatus) {
  const firstPage = await requestService.list({ status, page: 1, limit: REQUEST_PAGE_LIMIT });
  const totalPages = getTotalPages(firstPage);
  const items = [...getItems(firstPage)];

  if (totalPages > 1) {
    const remainingPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, index) => {
        return requestService.list({ status, page: index + 2, limit: REQUEST_PAGE_LIMIT });
      }),
    );
    remainingPages.forEach(page => items.push(...getItems(page)));
  }

  return items;
}

async function fetchWorkerSchedule() {
  const groups = await Promise.all(SCHEDULED_STATUSES.map(fetchStatusPages));
  return groups.flat();
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateKeyFromIso(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : dateKey(date);
}

function monthCells(month: Date) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return date;
  });
}

function monthTitle(date: Date, locale: string) {
  return formatAppDate(date, locale, { month: 'long', year: 'numeric' });
}

function calendarMonthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function selectedDateTitle(date: Date, locale: string) {
  return formatAppDate(date, locale, { day: 'numeric', month: 'long' });
}

function timeLabel(iso: string | null | undefined, locale: string, unavailable: string) {
  if (!iso) return unavailable;
  const formatted = formatAppTime(iso, locale);
  return formatted === '-' ? unavailable : formatted;
}

function sortByScheduledAt(a: ServiceRequest, b: ServiceRequest) {
  return new Date(a.scheduledAt ?? 0).getTime() - new Date(b.scheduledAt ?? 0).getTime();
}

function ScheduledJobCard({
  job,
  onOpen,
  locale,
  languageCode,
  t,
}: {
  job: ServiceRequest;
  onOpen: () => void;
  locale: string;
  languageCode: ReturnType<typeof useLanguage>['language']['code'];
  t: ReturnType<typeof useLanguage>['t'];
}) {
  const customerName = job.customer?.fullName ?? t('calendar.customerUnavailable');
  const category = job.category ? getLocalizedCategoryName(job.category, languageCode, t) : t('worker.requests.serviceRequest');
  const location = job.address || t('calendar.locationUnavailable');

  return (
    <Pressable onPress={onOpen}>
      <Card style={job.status === 'COMPLETED' ? styles.completedCard : undefined}>
        <Stack gap={spacing.md}>
          <Row justify="space-between" align="flex-start">
            <Stack gap={spacing.xs} style={styles.jobMain}>
              <BodySm weight="bold" color={colors.brand}>{timeLabel(job.scheduledAt, locale, t('calendar.timeUnavailable'))}</BodySm>
              <Body weight="bold">{job.title || category}</Body>
              <BodySm color={colors.textSecondary}>{category}</BodySm>
            </Stack>
            <StatusBadge status={job.status} />
          </Row>
          <BodySm color={colors.textSecondary} numberOfLines={2}>{job.description || t('calendar.noDescription')}</BodySm>
          <Stack gap={spacing.xs}>
            <Row gap={spacing.xs} align="flex-start">
              <Ionicons name="person-outline" size={16} color={colors.textTertiary} />
              <BodySm color={colors.textSecondary} style={styles.jobMetaText}>{customerName}</BodySm>
            </Row>
            <Row gap={spacing.xs} align="flex-start">
              <Ionicons name="location-outline" size={16} color={colors.textTertiary} />
              <BodySm color={colors.textSecondary} style={styles.jobMetaText}>{location}</BodySm>
            </Row>
          </Stack>
          <Button title={t('calendar.openJob')} size="sm" variant="outline" onPress={onOpen} />
        </Stack>
      </Card>
    </Pressable>
  );
}

export default function AvailabilityScreen() {
  const { isRTL, t, locale, language } = useLanguage();
  const navigation = useNavigation<Nav>();
  const user = useAuthStore(s => s.user);
  const today = useMemo(() => startOfDay(new Date()), []);
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDate, setSelectedDate] = useState(today);

  const requestsQuery = useQuery({
    queryKey: queryKeys.workerCalendar(user?.id, calendarMonthKey(visibleMonth)),
    queryFn: fetchWorkerSchedule,
    enabled: Boolean(user?.id),
    retry: 1,
  });

  React.useEffect(() => {
    if (requestsQuery.isError && __DEV__) {
      const error = requestsQuery.error;
      console.warn('[WorkCalendar] Failed to load worker schedule', {
        method: 'GET',
        endpoint: '/requests',
        statuses: SCHEDULED_STATUSES,
        page: 1,
        limit: REQUEST_PAGE_LIMIT,
        status: error instanceof ApiRequestError ? error.status : undefined,
        message: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof ApiRequestError ? error.details : undefined,
      });
    }
  }, [requestsQuery.error, requestsQuery.isError]);

  const jobs = useMemo(() => {
    return (requestsQuery.data ?? [])
      .filter(job => SCHEDULED_STATUSES.includes(job.status))
      .sort(sortByScheduledAt);
  }, [requestsQuery.data]);

  const scheduledJobs = useMemo(() => jobs.filter(job => Boolean(dateKeyFromIso(job.scheduledAt))), [jobs]);
  const unscheduledJobs = useMemo(() => jobs.filter(job => !dateKeyFromIso(job.scheduledAt)), [jobs]);

  const jobsByDate = useMemo(() => {
    const grouped = new Map<string, ServiceRequest[]>();
    scheduledJobs.forEach(job => {
      const key = dateKeyFromIso(job.scheduledAt);
      if (!key) return;
      grouped.set(key, [...(grouped.get(key) ?? []), job]);
    });
    return grouped;
  }, [scheduledJobs]);

  const selectedKey = dateKey(selectedDate);
  const selectedJobs = jobsByDate.get(selectedKey) ?? [];
  const cells = monthCells(visibleMonth);
  const weekdays = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    return formatAppDate(new Date(2024, 0, 7 + index), locale, { weekday: 'short' });
  }), [locale]);

  const goToToday = () => {
    const current = startOfDay(new Date());
    setVisibleMonth(new Date(current.getFullYear(), current.getMonth(), 1));
    setSelectedDate(current);
  };

  const changeMonth = (amount: number) => {
    setVisibleMonth(current => {
      const next = addMonths(current, amount);
      setSelectedDate(startOfDay(next));
      return next;
    });
  };

  if (requestsQuery.isLoading) {
    return (
      <Screen>
        <H2>{t('calendar.title')}</H2>
        <ListSkeleton count={5} />
      </Screen>
    );
  }

  if (requestsQuery.isError) {
    return (
      <ErrorState
        message={t('calendar.loadingError')}
        onRetry={requestsQuery.refetch}
      />
    );
  }

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={requestsQuery.isRefetching}
            onRefresh={requestsQuery.refetch}
            tintColor={colors.primary}
          />
        }
      >
        <Stack gap={spacing.xs}>
          <H2>{t('calendar.title')}</H2>
          <BodySm color={colors.textSecondary}>{t('calendar.subtitle')}</BodySm>
        </Stack>

        <Card>
          <Stack gap={spacing.md}>
            <Row justify="space-between">
              <Pressable style={styles.monthButton} onPress={() => changeMonth(-1)}>
                <Ionicons name={isRTL ? 'chevron-forward' : 'chevron-back'} size={20} color={colors.textPrimary} />
              </Pressable>
              <Stack gap={spacing.xs} style={styles.monthTitle}>
                <H3 center>{monthTitle(visibleMonth, locale)}</H3>
                <BodySm center color={colors.textSecondary}>{t('calendar.scheduledLoaded', { count: scheduledJobs.length })}</BodySm>
              </Stack>
              <Pressable style={styles.monthButton} onPress={() => changeMonth(1)}>
                <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.textPrimary} />
              </Pressable>
            </Row>

            <Row gap={spacing.sm}>
              <Button title={t('common.today')} size="sm" variant="outline" fullWidth={false} onPress={goToToday} />
              <Button title={t('common.refresh')} size="sm" variant="ghost" fullWidth={false} loading={requestsQuery.isRefetching} onPress={() => requestsQuery.refetch()} />
            </Row>

            <View style={[styles.weekHeader, isRTL && styles.rowReverse]}>
              {weekdays.map(day => (
                <BodySm key={day} center weight="semibold" color={colors.textTertiary} style={styles.weekday}>{day}</BodySm>
              ))}
            </View>

            <View style={[styles.calendarGrid, isRTL && styles.rowReverse]}>
              {cells.map(cell => {
                const key = dateKey(cell);
                const count = jobsByDate.get(key)?.length ?? 0;
                const inMonth = cell.getMonth() === visibleMonth.getMonth();
                const selected = key === selectedKey;
                const isToday = key === dateKey(today);

                return (
                  <Pressable
                    key={key}
                    style={[
                      styles.dayCell,
                      !inMonth && styles.dayCellMuted,
                      isToday && styles.dayCellToday,
                      selected && styles.dayCellSelected,
                    ]}
                    onPress={() => setSelectedDate(startOfDay(cell))}
                  >
                    <BodySm
                      center
                      weight={selected || isToday ? 'bold' : 'medium'}
                      color={selected ? colors.textInverse : inMonth ? colors.textPrimary : colors.textTertiary}
                    >
                      {cell.getDate()}
                    </BodySm>
                    {count > 0 ? (
                      <View style={[styles.jobCount, selected && styles.jobCountSelected]}>
                        <BodySm center weight="bold" color={selected ? colors.primary : colors.textInverse} style={styles.jobCountText}>
                          {count}
                        </BodySm>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </Stack>
        </Card>

        <Stack gap={spacing.md}>
          <Row justify="space-between" align="flex-start">
            <Stack gap={spacing.xs} style={styles.agendaTitle}>
              <H3>{selectedDateTitle(selectedDate, locale)}</H3>
              <BodySm color={colors.textSecondary}>
                {selectedJobs.length === 1 ? t('calendar.selectedCountOne') : t('calendar.selectedCount', { count: selectedJobs.length })}
              </BodySm>
            </Stack>
            <Badge label={selectedJobs.length > 0 ? t('calendar.scheduled') : t('calendar.clear')} tone={selectedJobs.length > 0 ? 'brand' : 'neutral'} />
          </Row>

          {selectedJobs.length === 0 ? (
            <EmptyState
              icon="calendar-clear-outline"
              title={t('calendar.noJobsTitle')}
              message={t('calendar.noJobsMessage')}
            />
          ) : (
            selectedJobs.map(job => (
              <ScheduledJobCard
                key={job.id}
                job={job}
                locale={locale}
                languageCode={language.code}
                t={t}
                onOpen={() => navigation.navigate('ActiveJob', { requestId: job.id })}
              />
            ))
          )}
        </Stack>

        {unscheduledJobs.length > 0 ? (
          <Card>
            <Stack gap={spacing.md}>
              <Row justify="space-between" align="flex-start">
                <Stack gap={spacing.xs} style={styles.jobMain}>
                  <H3>{t('calendar.needsSchedule')}</H3>
                  <BodySm color={colors.textSecondary}>
                    {t('calendar.needsScheduleMessage')}
                  </BodySm>
                </Stack>
                <Badge label={`${unscheduledJobs.length}`} tone="neutral" />
              </Row>
              {unscheduledJobs.slice(0, 3).map(job => (
                <Pressable key={job.id} style={[styles.unscheduledRow, isRTL && styles.rowReverse]} onPress={() => navigation.navigate('ActiveJob', { requestId: job.id })}>
                  <Stack gap={spacing.xs} style={styles.jobMain}>
                    <Body weight="bold">{job.title}</Body>
                    <BodySm color={colors.textSecondary}>{job.category ? getLocalizedCategoryName(job.category, language.code, t) : t('worker.requests.serviceRequest')}</BodySm>
                  </Stack>
                  <StatusBadge status={job.status} />
                </Pressable>
              ))}
            </Stack>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.lg },
  monthButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthTitle: { flex: 1 },
  weekHeader: { flexDirection: 'row', gap: spacing.xs },
  rowReverse: { flexDirection: 'row-reverse' },
  weekday: { flex: 1 },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
  },
  dayCell: {
    width: `${100 / 7}%`,
    maxWidth: `${100 / 7}%`,
    minHeight: 50,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayCellMuted: { opacity: 0.42 },
  dayCellToday: { borderColor: colors.brand },
  dayCellSelected: { backgroundColor: colors.primary, borderColor: colors.primary, opacity: 1 },
  jobCount: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brand,
  },
  jobCountSelected: { backgroundColor: colors.surface },
  jobCountText: { fontSize: fontSize.xs, lineHeight: 14 },
  agendaTitle: { flex: 1 },
  jobMain: { flex: 1 },
  jobMetaText: { flex: 1 },
  completedCard: { backgroundColor: colors.successSoft, borderColor: '#BBF7D0' },
  unscheduledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
