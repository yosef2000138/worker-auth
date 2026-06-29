import { formatAppDate, formatCurrency } from '@/i18n/formatters';

export const formatMoney = (value?: number | string | null, currency = 'ILS', locale = 'en') => {
  return formatCurrency(value, locale, currency === '₪' ? 'ILS' : currency);
};

export const formatDate = (iso?: string | null, locale = 'en') => formatAppDate(iso, locale);

export const compactStatus = (s?: string) => s ? s.replaceAll('_', ' ').toLowerCase() : '';
