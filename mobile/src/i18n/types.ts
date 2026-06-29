import type { en } from './locales/en';

export type LanguageCode = 'en' | 'ar' | 'he' | 'ru';
export type Direction = 'ltr' | 'rtl';

export type LanguageOption = {
  code: LanguageCode;
  nativeName: string;
  direction: Direction;
};

export type TranslationKey = keyof typeof en;
export type TranslationValues = Record<string, string | number>;
export type TranslateFn = (key: TranslationKey, values?: TranslationValues) => string;
export type LocaleRecord = Record<TranslationKey, string>;
