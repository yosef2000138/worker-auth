import { SUBSCRIPTION_CONFIG } from './config';

function configuredPriceSource(storeLocalizedPrice?: string | null) {
  return storeLocalizedPrice?.trim() || SUBSCRIPTION_CONFIG.plannedPriceLabel;
}

export function normalizeWorkerProPrice(price: string, locale: string) {
  const cleaned = price
    .replace(/^Planned price:\s*/i, '')
    .replace(/\/month$/i, '')
    .trim();
  const shekelMatch = cleaned.match(/^₪\s?(.+)$/);

  if (shekelMatch && (locale === 'ar' || locale === 'he' || locale === 'ru')) {
    return `${shekelMatch[1]} ₪`;
  }

  return cleaned;
}

export function getWorkerProPrice(locale: string, storeLocalizedPrice?: string | null) {
  return normalizeWorkerProPrice(configuredPriceSource(storeLocalizedPrice), locale);
}
