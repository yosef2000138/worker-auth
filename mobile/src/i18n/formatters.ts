import { localeForLanguage } from './direction';
import type { LanguageCode, TranslateFn, TranslationKey, TranslationValues } from './types';

type LocaleInput = LanguageCode | string | undefined | null;
type PluralKeys = Partial<Record<Intl.LDMLPluralRule, TranslationKey>> & { other: TranslationKey };

function resolveLocale(input?: LocaleInput) {
  if (!input) return localeForLanguage('en');
  if (input === 'en' || input === 'ar' || input === 'he' || input === 'ru') {
    return localeForLanguage(input);
  }
  return input;
}

function toFiniteNumber(value?: number | string | null) {
  if (value == null || value === '') return null;
  const amount = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(amount) ? amount : null;
}

export function formatNumber(value?: number | string | null, languageOrLocale?: LocaleInput, options?: Intl.NumberFormatOptions) {
  const amount = toFiniteNumber(value);
  if (amount == null) return '-';
  return new Intl.NumberFormat(resolveLocale(languageOrLocale), options).format(amount);
}

export function formatCurrency(value?: number | string | null, languageOrLocale?: LocaleInput, currency = 'ILS') {
  const amount = toFiniteNumber(value);
  if (amount == null) return '-';
  return new Intl.NumberFormat(resolveLocale(languageOrLocale), {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatAppDate(value?: string | number | Date | null, languageOrLocale?: LocaleInput, options?: Intl.DateTimeFormatOptions) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(resolveLocale(languageOrLocale), options ?? {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatAppTime(value?: string | number | Date | null, languageOrLocale?: LocaleInput, options?: Intl.DateTimeFormatOptions) {
  if (!value) return '-';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat(resolveLocale(languageOrLocale), options ?? {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

export function formatPlural(
  languageOrLocale: LocaleInput,
  count: number,
  keys: PluralKeys,
  t: TranslateFn,
  values?: TranslationValues,
) {
  const locale = resolveLocale(languageOrLocale);
  const rule = new Intl.PluralRules(locale).select(count);
  return t(keys[rule] ?? keys.other, { count, ...values });
}
