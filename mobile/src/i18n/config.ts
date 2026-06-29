import type { LanguageCode, LanguageOption } from './types';

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', nativeName: 'English', direction: 'ltr' },
  { code: 'ar', nativeName: 'العربية', direction: 'rtl' },
  { code: 'he', nativeName: 'עברית', direction: 'rtl' },
  { code: 'ru', nativeName: 'Русский', direction: 'ltr' },
];

export const SUPPORTED_LANGUAGE_CODES = LANGUAGE_OPTIONS.map(option => option.code) as LanguageCode[];

export const LANGUAGE_KEY = 'worker_app_language';
export const LANGUAGE_MANUAL_KEY = 'worker_app_language_manual';
