import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import {
  AuthBanner,
  AuthButton,
  AuthInput,
  CheckRow,
  LogoMark,
  StepIndicator,
  SuccessMark,
  authPalette,
} from '@/components/auth';
import { formatAppDate, getLocalizedCategoryName, useLanguage } from '@/i18n';
import { userService } from '@/services/userService';
import { workerService } from '@/services/workerService';
import { useAuthStore } from '@/store/authStore';
import { useAuth } from '@/hooks/useAuth';
import { Category, WorkerProfile } from '@/types';
import { isWorkerProfileComplete, workerCategoryIds, workerProfileMissingItemKeys } from '@/utils/workerProfile';
import { queryKeys } from '@/utils/queryKeys';

const secureDraftOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

async function loadPrivateDraft(key: string) {
  const encryptedDraft = await SecureStore.getItemAsync(key);
  if (encryptedDraft) return encryptedDraft;

  const legacyDraft = await AsyncStorage.getItem(key);
  if (!legacyDraft) return null;

  await SecureStore.setItemAsync(key, legacyDraft, secureDraftOptions);
  await AsyncStorage.removeItem(key);
  return legacyDraft;
}

type Props = {
  initialWorker?: WorkerProfile;
  onComplete?: () => void;
};

type IconName = keyof typeof Ionicons.glyphMap;
type Draft = {
  fullName?: string;
  phone?: string;
  avatarUrl?: string;
  bio?: string;
  yearsExp?: string;
  hourlyRate?: string;
  categoryIds?: string[];
  primaryServiceCity?: string;
  additionalServiceCities?: string;
  serviceRadiusKm?: string;
  baseLatitude?: string;
  baseLongitude?: string;
  isAvailable?: boolean;
  days?: number[];
  startTime?: string;
  endTime?: string;
  portfolioPlaceholders?: string[];
  verificationReady?: boolean;
  certificateNote?: string;
};

const TOTAL_STEPS = 6;
const PHONE_REGEX = /^(\+?[1-9]\d{7,14}|0\d{8,14})$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;
const DAYS = [
  { index: 0 },
  { index: 1 },
  { index: 2 },
  { index: 3 },
  { index: 4 },
  { index: 5 },
  { index: 6 },
];

function isUrl(value: string) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function generatedAvatarUrl(name: string) {
  const safeName = encodeURIComponent(name.trim() || 'Worker');
  return `https://ui-avatars.com/api/?name=${safeName}&background=111827&color=fff&size=256`;
}

function localizedDayLabel(index: number, locale: string) {
  const sunday = new Date(Date.UTC(2024, 0, 7 + index));
  return formatAppDate(sunday, locale, { weekday: 'short' });
}

function categoryIcon(category: Category): IconName {
  const icon = category.icon ?? 'briefcase-outline';
  return icon in Ionicons.glyphMap ? (icon as IconName) : 'briefcase-outline';
}

function daySummary(days: number[], locale: string, emptyLabel: string) {
  if (days.length === 0) return emptyLabel;
  return DAYS.filter(day => days.includes(day.index)).map(day => localizedDayLabel(day.index, locale)).join(', ');
}

export default function WorkerOnboardingScreen({ initialWorker, onComplete }: Props) {
  const { t, locale, isRTL, language } = useLanguage();
  const queryClient = useQueryClient();
  const user = useAuthStore(s => s.user);
  const setUser = useAuthStore(s => s.setUser);
  const { logout } = useAuth();
  const draftKey = `worker_onboarding_draft_${user?.id ?? initialWorker?.user?.id ?? 'current'}`;

  const [step, setStep] = useState(1);
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  const [fullName, setFullName] = useState(initialWorker?.user?.fullName ?? user?.fullName ?? '');
  const [phone, setPhone] = useState(initialWorker?.user?.phone ?? user?.phone ?? '');
  const [avatarUrl, setAvatarUrl] = useState(initialWorker?.user?.avatarUrl ?? user?.avatarUrl ?? '');
  const [bio, setBio] = useState(initialWorker?.bio ?? '');
  const [yearsExp, setYearsExp] = useState(initialWorker?.yearsExp != null ? String(initialWorker.yearsExp) : '');
  const [hourlyRate, setHourlyRate] = useState(initialWorker?.hourlyRate != null ? String(initialWorker.hourlyRate) : '');
  const [categoryIds, setCategoryIds] = useState<string[]>(() => workerCategoryIds(initialWorker));
  const [primaryServiceCity, setPrimaryServiceCity] = useState(initialWorker?.primaryServiceCity ?? '');
  const [additionalServiceCities, setAdditionalServiceCities] = useState((initialWorker?.additionalServiceCities ?? []).join(', '));
  const [serviceRadiusKm, setServiceRadiusKm] = useState(initialWorker?.serviceRadiusKm != null ? String(initialWorker.serviceRadiusKm) : '');
  const [baseLatitude, setBaseLatitude] = useState(initialWorker?.baseLatitude != null ? String(initialWorker.baseLatitude) : '');
  const [baseLongitude, setBaseLongitude] = useState(initialWorker?.baseLongitude != null ? String(initialWorker.baseLongitude) : '');
  const [isAvailable, setIsAvailable] = useState(initialWorker?.isAvailable ?? true);
  const [days, setDays] = useState<number[]>(initialWorker?.availability?.map(slot => slot.dayOfWeek) ?? [0, 1, 2, 3, 4]);
  const [startTime, setStartTime] = useState(initialWorker?.availability?.[0]?.startTime ?? '09:00');
  const [endTime, setEndTime] = useState(initialWorker?.availability?.[0]?.endTime ?? '18:00');
  const [portfolioPlaceholders, setPortfolioPlaceholders] = useState<string[]>([]);
  const [verificationReady, setVerificationReady] = useState(false);
  const [certificateNote, setCertificateNote] = useState('');

  const categoriesQuery = useQuery({
    queryKey: ['categories'],
    queryFn: workerService.categories,
  });

  useEffect(() => {
    let mounted = true;
    loadPrivateDraft(draftKey)
      .then(raw => {
        if (!mounted || !raw) return;
        const draft = JSON.parse(raw) as Draft;
        setFullName(draft.fullName ?? fullName);
        setPhone(draft.phone ?? phone);
        setAvatarUrl(draft.avatarUrl ?? avatarUrl);
        setBio(draft.bio ?? bio);
        setYearsExp(draft.yearsExp ?? yearsExp);
        setHourlyRate(draft.hourlyRate ?? hourlyRate);
        setCategoryIds(draft.categoryIds ?? categoryIds);
        setPrimaryServiceCity(draft.primaryServiceCity ?? '');
        setAdditionalServiceCities(draft.additionalServiceCities ?? '');
        setServiceRadiusKm(draft.serviceRadiusKm ?? serviceRadiusKm);
        setBaseLatitude(draft.baseLatitude ?? '');
        setBaseLongitude(draft.baseLongitude ?? '');
        setIsAvailable(draft.isAvailable ?? isAvailable);
        setDays(draft.days ?? days);
        setStartTime(draft.startTime ?? startTime);
        setEndTime(draft.endTime ?? endTime);
        setPortfolioPlaceholders(draft.portfolioPlaceholders ?? []);
        setVerificationReady(draft.verificationReady ?? false);
        setCertificateNote(draft.certificateNote ?? '');
      })
      .finally(() => {
        if (mounted) setDraftLoaded(true);
      });

    return () => {
      mounted = false;
    };
    // Draft is intentionally loaded once for the active user.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  const draft: Draft = useMemo(() => ({
    fullName,
    phone,
    avatarUrl,
    bio,
    yearsExp,
    hourlyRate,
    categoryIds,
    primaryServiceCity,
    additionalServiceCities,
    serviceRadiusKm,
    baseLatitude,
    baseLongitude,
    isAvailable,
    days,
    startTime,
    endTime,
    portfolioPlaceholders,
    verificationReady,
    certificateNote,
  }), [additionalServiceCities, avatarUrl, baseLatitude, baseLongitude, bio, categoryIds, certificateNote, days, endTime, fullName, hourlyRate, isAvailable, phone, portfolioPlaceholders, primaryServiceCity, serviceRadiusKm, startTime, verificationReady, yearsExp]);

  useEffect(() => {
    if (!draftLoaded || success) return;
    const timer = setTimeout(() => {
      SecureStore.setItemAsync(draftKey, JSON.stringify(draft), secureDraftOptions).catch(() => undefined);
    }, 250);
    return () => clearTimeout(timer);
  }, [draft, draftKey, draftLoaded, success]);

  const profileErrors = useMemo(() => {
    const errors: string[] = [];
    const exp = Number(yearsExp);
    const rate = Number(hourlyRate);
    if (fullName.trim().length < 2) errors.push(t('validation.fullName'));
    if (!PHONE_REGEX.test(phone.trim())) errors.push(t('validation.phone'));
    if (!isUrl(avatarUrl.trim())) errors.push(t('validation.avatarUrl'));
    if (bio.trim().length < 20) errors.push(t('validation.bioLength'));
    if (!Number.isFinite(exp) || exp < 0 || exp > 60) errors.push(t('validation.experienceRange'));
    if (!Number.isFinite(rate) || rate <= 0) errors.push(t('validation.hourlyRatePositive'));
    return errors;
  }, [avatarUrl, bio, fullName, hourlyRate, phone, t, yearsExp]);

  const locationErrors = useMemo(() => {
    const radius = serviceRadiusKm.trim() ? Number(serviceRadiusKm) : null;
    const latitude = baseLatitude.trim() ? Number(baseLatitude) : null;
    const longitude = baseLongitude.trim() ? Number(baseLongitude) : null;
    const errors: string[] = [];
    if (primaryServiceCity.trim().length < 2) errors.push(t('validation.serviceCityRequired'));
    if (radius != null && (!Number.isFinite(radius) || radius < 1 || radius > 100)) errors.push(t('validation.serviceRadius'));
    if ((latitude == null) !== (longitude == null)) errors.push(t('validation.baseLocationPair'));
    return errors;
  }, [baseLatitude, baseLongitude, primaryServiceCity, serviceRadiusKm, t]);

  const availabilityErrors = useMemo(() => {
    const errors: string[] = [];
    if (days.length === 0) errors.push(t('validation.availableDay'));
    if (!TIME_REGEX.test(startTime) || !TIME_REGEX.test(endTime)) errors.push(t('validation.timeFormat'));
    if (TIME_REGEX.test(startTime) && TIME_REGEX.test(endTime) && startTime >= endTime) errors.push(t('validation.endAfterStart'));
    return errors;
  }, [days.length, endTime, startTime, t]);

  const stepErrors = useMemo(() => {
    if (step === 1) return profileErrors;
    if (step === 2) return categoryIds.length === 0 ? [t('validation.categoryRequired')] : [];
    if (step === 3) return locationErrors;
    if (step === 4) return availabilityErrors;
    return [];
  }, [availabilityErrors, categoryIds.length, locationErrors, profileErrors, step, t]);

  const toggleCategory = (id: string) => {
    setCategoryIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]);
  };

  const toggleDay = (index: number) => {
    setDays(current => current.includes(index) ? current.filter(day => day !== index) : [...current, index].sort());
  };

  const handleCurrentLocation = async () => {
    setError('');
    setLocationLoading(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setError(t('map.currentUnavailable'));
        return;
      }

      const position = await Location.getCurrentPositionAsync({});
      setBaseLatitude(position.coords.latitude.toFixed(6));
      setBaseLongitude(position.coords.longitude.toFixed(6));
      if (!serviceRadiusKm.trim()) setServiceRadiusKm('20');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('map.currentError'));
    } finally {
      setLocationLoading(false);
    }
  };

  const handleNext = () => {
    setError('');
    if (stepErrors.length > 0) {
      setError(stepErrors[0]);
      return;
    }
    setStep(current => Math.min(TOTAL_STEPS, current + 1));
  };

  const handleBack = () => {
    setError('');
    setStep(current => Math.max(1, current - 1));
  };

  const handleLogout = () => {
    void logout();
  };

  const handleFinish = async () => {
    setError('');
    if (stepErrors.length > 0) {
      setError(stepErrors[0]);
      return;
    }

    const allErrors = [...profileErrors, ...(categoryIds.length === 0 ? [t('validation.categoryRequired')] : []), ...locationErrors, ...availabilityErrors];
    if (allErrors.length > 0) {
      setStep(profileErrors.length ? 1 : categoryIds.length === 0 ? 2 : locationErrors.length ? 3 : 4);
      setError(allErrors[0]);
      return;
    }

    setSaving(true);
    try {
      const updatedUser = await userService.updateProfile({
        fullName: fullName.trim(),
        phone: phone.trim(),
        avatarUrl: avatarUrl.trim(),
      });

      await workerService.updateMe({
        bio: bio.trim(),
        yearsExp: Number.parseInt(yearsExp, 10),
        hourlyRate: Number(hourlyRate),
        primaryServiceCity: primaryServiceCity.trim() || null,
        additionalServiceCities: additionalServiceCities.split(',').map(city => city.trim()).filter(Boolean),
        serviceRadiusKm: serviceRadiusKm.trim() ? Number.parseInt(serviceRadiusKm, 10) : null,
        baseLatitude: baseLatitude.trim() ? Number(baseLatitude) : null,
        baseLongitude: baseLongitude.trim() ? Number(baseLongitude) : null,
      });

      await workerService.setCategories(categoryIds);
      await workerService.setAvailability(days.map(dayOfWeek => ({ dayOfWeek, startTime, endTime })));
      await workerService.toggleAvailability(isAvailable);
      const localDetailsKey = `${draftKey}_local_details`;
      await SecureStore.setItemAsync(localDetailsKey, JSON.stringify({ portfolioPlaceholders, verificationReady, certificateNote }), secureDraftOptions).catch(() => undefined);
      await AsyncStorage.removeItem(localDetailsKey).catch(() => undefined);
      await Promise.all([
        SecureStore.deleteItemAsync(draftKey),
        AsyncStorage.removeItem(draftKey),
      ]);

      setUser(updatedUser);
      const latestWorker = await workerService.me();
      queryClient.setQueryData(queryKeys.workerMe(user?.id), latestWorker);

      if (!isWorkerProfileComplete(latestWorker)) {
        setError(t('worker.onboarding.missingItems', { items: workerProfileMissingItemKeys(latestWorker).map(key => t(key)).join(', ') }));
        return;
      }

      setSuccess(true);
      setTimeout(() => onComplete?.(), 950);
    } catch (err) {
      setError(t('worker.onboarding.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (success) {
    return (
      <View style={styles.root}>
        <View style={styles.successCard}>
          <SuccessMark active />
          <Text style={[styles.successTitle, isRTL && styles.rtlText]}>{t('worker.onboarding.successTitle')}</Text>
          <Text style={[styles.successBody, isRTL && styles.rtlText]}>{t('worker.onboarding.successBody')}</Text>
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={[styles.header, isRTL && styles.rowReverse]}>
        <LogoMark size={44} />
        <View style={styles.headerCopy}>
          <Text style={[styles.eyebrow, isRTL && styles.rtlText]}>{t('worker.onboarding.eyebrow')}</Text>
          <Text style={[styles.title, isRTL && styles.rtlText]}>{t('worker.onboarding.title')}</Text>
          <Text style={[styles.subtitle, isRTL && styles.rtlText]}>{t('worker.onboarding.subtitle')}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <StepIndicator step={step} total={TOTAL_STEPS} />
        {error ? <AuthBanner tone="danger" title={t('worker.onboarding.checkStep')} message={error} /> : null}

        {step === 1 ? (
          <View style={styles.step}>
            <Text style={[styles.stepTitle, isRTL && styles.rtlText]}>{t('worker.onboarding.personalTitle')}</Text>
            <AuthInput label={t('register.fullName')} value={fullName} onChangeText={setFullName} placeholder={t('register.fullNamePlaceholder')} leftIcon="person-outline" autoCapitalize="words" />
            <AuthInput label={t('worker.onboarding.phoneNumber')} value={phone} onChangeText={setPhone} placeholder="0501234567" keyboardType="phone-pad" leftIcon="call-outline" />
            <AuthInput label={t('worker.onboarding.profilePhotoUrl')} value={avatarUrl} onChangeText={setAvatarUrl} placeholder="https://..." keyboardType="url" leftIcon="image-outline" />
            <AuthButton title={t('worker.onboarding.useGeneratedAvatar')} variant="secondary" icon="sparkles-outline" onPress={() => setAvatarUrl(generatedAvatarUrl(fullName))} />
            <AuthInput label={t('worker.onboarding.shortBio')} value={bio} onChangeText={setBio} placeholder={t('worker.onboarding.bioPlaceholder')} multiline leftIcon="create-outline" />
            <View style={styles.twoCol}>
              <AuthInput label={t('worker.onboarding.years')} value={yearsExp} onChangeText={setYearsExp} placeholder="5" keyboardType="numeric" leftIcon="time-outline" containerStyle={styles.flexItem} />
              <AuthInput label={t('profile.hourlyRate')} value={hourlyRate} onChangeText={setHourlyRate} placeholder="120" keyboardType="numeric" leftIcon="cash-outline" containerStyle={styles.flexItem} />
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View style={styles.step}>
            <Text style={[styles.stepTitle, isRTL && styles.rtlText]}>{t('worker.onboarding.workCategories')}</Text>
            <Text style={[styles.note, isRTL && styles.rtlText]}>{t('worker.onboarding.categoriesFromBackend')}</Text>
            {categoriesQuery.isLoading ? <Text style={[styles.note, isRTL && styles.rtlText]}>{t('worker.onboarding.loadingCategories')}</Text> : null}
            {categoriesQuery.isError ? <AuthBanner tone="danger" title={t('worker.onboarding.categoriesLoadError')} message={categoriesQuery.error.message} /> : null}
            <View style={styles.categoryGrid}>
              {(categoriesQuery.data ?? []).map(category => {
                const selected = categoryIds.includes(category.id);
                return (
                  <Pressable key={category.id} style={[styles.categoryChip, isRTL && styles.rowReverse, selected && styles.categoryChipSelected]} onPress={() => toggleCategory(category.id)}>
                    <Ionicons name={categoryIcon(category)} size={18} color={selected ? authPalette.textInverse : authPalette.brand} />
                    <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>{getLocalizedCategoryName(category, language.code, t)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.step}>
            <Text style={[styles.stepTitle, isRTL && styles.rtlText]}>{t('worker.onboarding.serviceRadius')}</Text>
            <AuthBanner tone="info" title={t('worker.onboarding.serviceAreaSavedTitle')} message={t('worker.onboarding.locationLimitation')} />
            <AuthInput label={t('worker.onboarding.city')} value={primaryServiceCity} onChangeText={setPrimaryServiceCity} placeholder={t('worker.onboarding.cityPlaceholder')} leftIcon="business-outline" />
            <AuthInput label={t('worker.onboarding.additionalCities')} value={additionalServiceCities} onChangeText={setAdditionalServiceCities} placeholder={t('worker.onboarding.additionalCitiesPlaceholder')} leftIcon="map-outline" />
            <AuthInput label={t('worker.onboarding.workingRadius')} value={serviceRadiusKm} onChangeText={setServiceRadiusKm} placeholder="20" keyboardType="numeric" leftIcon="navigate-outline" />
            {serviceRadiusKm.trim() && !(baseLatitude && baseLongitude) ? (
              <Text style={[styles.note, isRTL && styles.rtlText]}>{t('worker.onboarding.radiusNeedsLocationInfo')}</Text>
            ) : null}
            <AuthButton title={baseLatitude && baseLongitude ? t('worker.onboarding.updateCurrentLocation') : t('worker.onboarding.useCurrentLocation')} variant="secondary" icon="location-outline" loading={locationLoading} onPress={handleCurrentLocation} />
            {baseLatitude && baseLongitude ? <Text style={[styles.note, isRTL && styles.rtlText]}>{t('worker.onboarding.baseLocationSaved', { lat: baseLatitude, lng: baseLongitude })}</Text> : null}
          </View>
        ) : null}

        {step === 4 ? (
          <View style={styles.step}>
            <Text style={[styles.stepTitle, isRTL && styles.rtlText]}>{t('worker.onboarding.availability')}</Text>
            <CheckRow checked={isAvailable} label={isAvailable ? t('worker.onboarding.online') : t('worker.onboarding.offline')} onPress={() => setIsAvailable(current => !current)} />
            <Text style={[styles.label, isRTL && styles.rtlText]}>{t('worker.onboarding.availableDays')}</Text>
            <View style={styles.dayGrid}>
              {DAYS.map(day => {
                const selected = days.includes(day.index);
                return (
                  <Pressable key={day.index} style={[styles.dayChip, selected && styles.dayChipSelected]} onPress={() => toggleDay(day.index)}>
                    <Text style={[styles.dayText, selected && styles.dayTextSelected]}>{localizedDayLabel(day.index, locale)}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={[styles.note, isRTL && styles.rtlText]}>{daySummary(days, locale, t('worker.onboarding.noDaysSelected'))}</Text>
            <View style={styles.twoCol}>
              <AuthInput label={t('worker.onboarding.start')} value={startTime} onChangeText={setStartTime} placeholder="09:00" leftIcon="time-outline" containerStyle={styles.flexItem} />
              <AuthInput label={t('worker.onboarding.end')} value={endTime} onChangeText={setEndTime} placeholder="18:00" leftIcon="time-outline" containerStyle={styles.flexItem} />
            </View>
          </View>
        ) : null}

        {step === 5 ? (
          <View style={styles.step}>
            <Text style={[styles.stepTitle, isRTL && styles.rtlText]}>{t('worker.onboarding.portfolio')}</Text>
            <AuthBanner tone="info" title={t('common.todo')} message={t('worker.onboarding.portfolioTodo')} />
            <View style={styles.placeholderGrid}>
              {portfolioPlaceholders.map((item, index) => (
                <View key={item} style={styles.placeholderCard}>
                  <Ionicons name="image-outline" size={26} color={authPalette.muted} />
                  <Text style={styles.placeholderText}>{t('worker.onboarding.workPhoto', { number: index + 1 })}</Text>
                </View>
              ))}
            </View>
            <AuthButton
              title={t('worker.onboarding.portfolioUnavailable')}
              variant="secondary"
              icon="lock-closed-outline"
              disabled
            />
          </View>
        ) : null}

        {step === 6 ? (
          <View style={styles.step}>
            <Text style={[styles.stepTitleCompact, isRTL && styles.rtlText]}>{t('worker.onboarding.verificationOptional')}</Text>
            <View style={styles.verificationCard}>
              <View style={[styles.verificationIconWrap, isRTL && styles.rowReverse]}>
                <View style={styles.verificationIcon}>
                  <Ionicons name="shield-checkmark-outline" size={22} color={authPalette.brand} />
                </View>
                <Text style={[styles.verificationLead, isRTL && styles.rtlText]}>{t('worker.onboarding.verificationSoon')}</Text>
              </View>
              <Text style={[styles.verificationBody, isRTL && styles.rtlText]}>{t('worker.onboarding.verificationFinishNow')}</Text>
              <Text style={[styles.verificationBody, isRTL && styles.rtlText]}>{t('worker.onboarding.verificationLater')}</Text>
              <View style={styles.verificationList}>
                {[
                  t('worker.onboarding.verificationItemId'),
                  t('worker.onboarding.verificationItemCertificates'),
                  t('worker.onboarding.verificationItemLicenses'),
                ].map(item => (
                  <View key={item} style={[styles.bulletRow, isRTL && styles.rowReverse]}>
                    <View style={styles.bulletDot} />
                    <Text style={[styles.bulletText, isRTL && styles.rtlText]}>{item}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.footer}>
          {step > 1 ? <AuthButton title={t('common.back')} variant="secondary" onPress={handleBack} style={styles.footerButton} /> : <AuthButton title={t('profile.logout')} variant="secondary" onPress={handleLogout} style={styles.footerButton} />}
          {step < TOTAL_STEPS ? (
            <AuthButton title={t('common.next')} icon="arrow-forward" onPress={handleNext} style={styles.footerButton} />
          ) : (
            <AuthButton title={t('worker.onboarding.finishSetup')} icon="checkmark" loading={saving} onPress={handleFinish} style={styles.footerButton} />
          )}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: authPalette.bg },
  content: { padding: 20, paddingTop: 56, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 20 },
  rowReverse: { flexDirection: 'row-reverse' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  headerCopy: { flex: 1 },
  eyebrow: { color: authPalette.brand, fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  title: { color: authPalette.ink, fontSize: 27, lineHeight: 32, fontWeight: '900', letterSpacing: 0, marginTop: 3 },
  subtitle: { color: authPalette.muted, fontSize: 13, lineHeight: 19, marginTop: 4 },
  card: {
    backgroundColor: authPalette.surface,
    borderRadius: 24,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: '#EAECF0',
    shadowColor: '#101828',
    shadowOpacity: 0.08,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 12 },
    elevation: 4,
  },
  step: { gap: 14 },
  stepTitle: { color: authPalette.ink, fontSize: 19, fontWeight: '900' },
  stepTitleCompact: { color: authPalette.ink, fontSize: 17, lineHeight: 23, fontWeight: '900' },
  twoCol: { flexDirection: 'row', gap: 10 },
  flexItem: { flex: 1 },
  note: { color: authPalette.muted, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  label: { color: authPalette.ink, fontSize: 13, fontWeight: '900' },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  categoryChip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: authPalette.line, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#FCFCFD' },
  categoryChipSelected: { backgroundColor: authPalette.brand, borderColor: authPalette.brand },
  categoryText: { color: authPalette.ink, fontSize: 13, fontWeight: '800' },
  categoryTextSelected: { color: authPalette.textInverse },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { minWidth: 44, alignItems: 'center', borderRadius: 14, borderWidth: 1, borderColor: authPalette.line, paddingVertical: 10, paddingHorizontal: 10, backgroundColor: '#FCFCFD' },
  dayChipSelected: { backgroundColor: authPalette.primary, borderColor: authPalette.primary },
  dayText: { color: authPalette.ink, fontWeight: '900', fontSize: 13 },
  dayTextSelected: { color: authPalette.textInverse },
  placeholderGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  placeholderCard: { width: '47%', minHeight: 92, borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: authPalette.lineStrong, alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FCFCFD' },
  placeholderText: { color: authPalette.muted, fontSize: 12, fontWeight: '800' },
  verificationCard: { borderRadius: 18, borderWidth: 1, borderColor: authPalette.line, backgroundColor: '#F9FAFB', padding: 16, gap: 10 },
  verificationIconWrap: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  verificationIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EAF1FF' },
  verificationLead: { flex: 1, color: authPalette.ink, fontSize: 15, lineHeight: 21, fontWeight: '900' },
  verificationBody: { color: authPalette.muted, fontSize: 13, lineHeight: 20, fontWeight: '600' },
  verificationList: { gap: 8, marginTop: 2 },
  bulletRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: authPalette.brand },
  bulletText: { color: authPalette.ink, fontSize: 13, lineHeight: 18, fontWeight: '800' },
  footer: { flexDirection: 'row', gap: 10 },
  footerButton: { flex: 1 },
  successCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  successTitle: { color: authPalette.ink, fontSize: 28, fontWeight: '900', marginTop: 20, textAlign: 'center' },
  successBody: { color: authPalette.muted, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
});
