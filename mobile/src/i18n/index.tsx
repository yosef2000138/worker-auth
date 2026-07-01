import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { NativeModules, View } from 'react-native';
import { LANGUAGE_KEY, LANGUAGE_MANUAL_KEY, LANGUAGE_OPTIONS } from './config';
import { localeForLanguage } from './direction';
import { formatPlural } from './formatters';
import { ar } from './locales/ar';
import { en } from './locales/en';
import { he } from './locales/he';
import { ru } from './locales/ru';
import type { LanguageCode, LanguageOption, LocaleRecord, TranslationKey, TranslationValues } from './types';

export { LANGUAGE_KEY, LANGUAGE_MANUAL_KEY, LANGUAGE_OPTIONS, SUPPORTED_LANGUAGE_CODES } from './config';
export { getLocalizedCategoryName, getCategoryTranslationKey } from './categoryNames';
export { directionForLanguage, isRtlLanguage, localeForLanguage, textAlignForLanguage, writingDirectionForLanguage } from './direction';
export { apiErrorCodeTranslationKeys, apiErrorMessageTranslationKeys } from './errorMessages';
export { formatAppDate, formatAppTime, formatCurrency, formatNumber, formatPlural } from './formatters';
export { getJobStatusLabel, getPaymentStatusLabel, getRequestStatusLabel, getSubscriptionStatusLabel, requestStatusTranslationKeys } from './statusLabels';
export type { Direction, LanguageCode, LanguageOption, LocaleRecord, TranslateFn, TranslationKey, TranslationValues } from './types';

export const translations: Record<LanguageCode, LocaleRecord> = { en, ar, he, ru };

type LanguageContextValue = {
  language: LanguageOption;
  isRTL: boolean;
  locale: string;
  hydrated: boolean;
  t: (key: TranslationKey, values?: TranslationValues) => string;
  plural: (keys: Partial<Record<Intl.LDMLPluralRule, TranslationKey>> & { other: TranslationKey }, count: number, values?: TranslationValues) => string;
  copy: (value: string) => string;
  setLanguage: (code: LanguageCode) => Promise<void>;
  changeLanguage: (code: LanguageCode) => Promise<void>;
};

const LanguageContext = createContext<LanguageContextValue | undefined>(undefined);
const warnedMissingKeys = new Set<string>();
let translationAuditLogged = false;

const copyKeyByValue: Record<string, TranslationKey> = {
  Worker: 'common.workerRole',
  Customer: 'common.customer',
  Loading: 'common.loading',
  'Try again': 'common.retry',
  Back: 'common.back',
  Next: 'common.next',
  Cancel: 'common.cancel',
  Close: 'common.close',
  Save: 'common.save',
  Edit: 'common.edit',
  Details: 'common.details',
  Map: 'common.map',
  Refresh: 'common.refresh',
  Today: 'common.today',
  Actions: 'common.actions',
  Status: 'common.status',
  Active: 'common.active',
  'Not active': 'common.inactive',
  Available: 'common.available',
  Unavailable: 'common.unavailable',
  'Worker Pro': 'subscription.title',
  Subscribe: 'subscription.subscribe',
  'Restore purchases': 'subscription.restore',
  'Manage subscription': 'subscription.manage',
  'Current status': 'subscription.currentStatus',
  Included: 'subscription.included',
  Access: 'subscription.access',
  Reviews: 'nav.reviews',
  Profile: 'nav.profile',
  'No reviews yet': 'reviews.emptyTitle',
  'Reviews appear after completed customer jobs.': 'reviews.emptyMessage',
  'Setup checklist': 'profile.setupChecklist',
  'Worker profile': 'profile.workerProfile',
  Bio: 'profile.bio',
  'Hourly rate': 'profile.hourlyRate',
  Experience: 'profile.experience',
  'Avatar URL': 'profile.avatarUrl',
  'Save worker profile': 'profile.saveWorker',
  'Save personal info': 'profile.savePersonal',
  'Subscription and billing': 'profile.subscriptionBilling',
  'Open Worker Pro': 'profile.openWorkerPro',
  'Full name': 'register.fullName',
  Email: 'auth.email',
  Phone: 'register.phone',
  'Save changes': 'common.save',
  'Sign out': 'common.signOut',
  'Work Calendar': 'nav.workCalendar',
  'Create request': 'nav.createRequest',
  Notifications: 'nav.notifications',
  'Incoming requests': 'nav.incomingRequests',
  'Job details': 'nav.jobDetails',
  Chat: 'nav.chat',
  'No notifications': 'notifications.emptyTitle',
  'Mark all read': 'notifications.markAllRead',
  'No conversations yet': 'messages.emptyTitle',
  'Could not load messages.': 'messages.loadError',
  'Open messages': 'messages.open',
  'No unread messages': 'messages.noUnread',
  'Go back': 'map.goBack',
  Recenter: 'map.recenter',
};

function getOption(code: string | null | undefined) {
  return LANGUAGE_OPTIONS.find(item => item.code === code) ?? LANGUAGE_OPTIONS[0];
}

function detectDeviceLanguage(): LanguageCode {
  const settings = NativeModules.SettingsManager?.settings;
  const locale =
    settings?.AppleLocale
    ?? settings?.AppleLanguages?.[0]
    ?? NativeModules.PlatformConstants?.localeIdentifier
    ?? '';
  const normalized = String(locale).toLowerCase();

  if (normalized.startsWith('ar')) return 'ar';
  if (normalized.startsWith('he') || normalized.startsWith('iw')) return 'he';
  if (normalized.startsWith('ru')) return 'ru';
  return 'en';
}

function interpolate(value: string, params?: TranslationValues) {
  if (!params) return value;
  return Object.entries(params).reduce((text, [key, replacement]) => {
    return text.replaceAll(`{${key}}`, String(replacement));
  }, value);
}

function auditTranslationKeys() {
  const baseKeys = Object.keys(en).sort();
  const baseSet = new Set(baseKeys);

  return LANGUAGE_OPTIONS.map(option => {
    const keys = Object.keys(translations[option.code]).sort();
    const keySet = new Set(keys);
    return {
      language: option.code,
      missing: baseKeys.filter(key => !keySet.has(key)),
      extra: keys.filter(key => !baseSet.has(key)),
    };
  });
}

function logTranslationAudit() {
  if (!__DEV__ || translationAuditLogged) return;
  translationAuditLogged = true;
  const issues = auditTranslationKeys().filter(result => result.missing.length || result.extra.length);
  if (issues.length) {
    console.warn('[i18n] Translation key mismatch', issues);
  }
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageOption>(LANGUAGE_OPTIONS[0]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    logTranslationAudit();
    let mounted = true;

    async function loadLanguage() {
      const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
      let option = getOption(savedLanguage);

      if (!savedLanguage) {
        option = getOption(detectDeviceLanguage());
        await AsyncStorage.multiSet([
          [LANGUAGE_KEY, option.code],
          [LANGUAGE_MANUAL_KEY, 'false'],
        ]);
      }

      if (mounted) {
        setLanguageState(option);
        setHydrated(true);
      }
    }

    loadLanguage().catch(() => {
      if (mounted) setHydrated(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const setLanguage = useCallback(async (code: LanguageCode) => {
    const next = getOption(code);

    await AsyncStorage.multiSet([
      [LANGUAGE_KEY, next.code],
      [LANGUAGE_MANUAL_KEY, 'true'],
    ]);
    setLanguageState(next);
  }, []);

  const t = useCallback((key: TranslationKey, values?: TranslationValues) => {
    const localized = translations[language.code][key];
    const fallback = translations.en[key];

    if (__DEV__ && localized == null && !warnedMissingKeys.has(`${language.code}:${key}`)) {
      warnedMissingKeys.add(`${language.code}:${key}`);
      console.warn(`[i18n] Missing translation key: ${key}\nLanguage: ${language.code}`);
    }

    return interpolate(localized ?? fallback ?? key, values);
  }, [language.code]);

  const plural = useCallback((keys: Partial<Record<Intl.LDMLPluralRule, TranslationKey>> & { other: TranslationKey }, count: number, values?: TranslationValues) => {
    return formatPlural(language.code, count, keys, t, values);
  }, [language.code, t]);

  const copy = useCallback((value: string) => {
    const key = copyKeyByValue[value];
    return key ? t(key) : value;
  }, [t]);

  const value = useMemo(() => ({
    language,
    isRTL: language.direction === 'rtl',
    locale: localeForLanguage(language.code),
    hydrated,
    t,
    plural,
    copy,
    setLanguage,
    changeLanguage: setLanguage,
  }), [copy, hydrated, language, plural, setLanguage, t]);

  if (!hydrated) {
    return <View style={{ flex: 1, backgroundColor: '#F4F7FB' }} />;
  }

  return (
    <LanguageContext.Provider value={value}>
      <View style={{ flex: 1, direction: value.isRTL ? 'rtl' : 'ltr' }}>
        {children}
      </View>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}


export const useAppLocalization = useLanguage;
export const useTranslation = useLanguage;
