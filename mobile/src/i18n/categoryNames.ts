import type { Category } from '@/types';
import type { LanguageCode, TranslateFn, TranslationKey } from './types';

type CategoryWithTranslations = Category & {
  code?: string | null;
  slug?: string | null;
  translations?: Partial<Record<LanguageCode, string>> | null;
  nameTranslations?: Partial<Record<LanguageCode, string>> | null;
  localizedNames?: Partial<Record<LanguageCode, string>> | null;
};

const categoryNameKeyBySlug: Record<string, TranslationKey> = {
  plumbing: 'categories.plumbing',
  electrical: 'categories.electrical',
  electric: 'categories.electrical',
  cleaning: 'categories.cleaning',
  painting: 'categories.painting',
  carpentry: 'categories.carpentry',
  carpenter: 'categories.carpentry',
  'air-conditioning': 'categories.airConditioning',
  airconditioning: 'categories.airConditioning',
  ac: 'categories.airConditioning',
  moving: 'categories.moving',
  gardening: 'categories.gardening',
  garden: 'categories.gardening',
  'appliance-repair': 'categories.applianceRepair',
  appliancerepair: 'categories.applianceRepair',
  'home-maintenance': 'categories.homeMaintenance',
  homemaintenance: 'categories.homeMaintenance',
  maintenance: 'categories.homeMaintenance',
};

function slugify(value?: string | null) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getCategoryTranslationKey(category?: CategoryWithTranslations | null) {
  if (!category) return undefined;
  const candidates = [category.code, category.slug, category.name]
    .map(slugify)
    .filter(Boolean);

  for (const candidate of candidates) {
    const direct = categoryNameKeyBySlug[candidate];
    if (direct) return direct;
    const compact = categoryNameKeyBySlug[candidate.replaceAll('-', '')];
    if (compact) return compact;
  }

  return undefined;
}

export function getLocalizedCategoryName(
  category: CategoryWithTranslations | null | undefined,
  language: LanguageCode,
  t: TranslateFn,
) {
  if (!category) return '';

  const backendTranslation =
    category.translations?.[language]
    ?? category.nameTranslations?.[language]
    ?? category.localizedNames?.[language];
  if (backendTranslation) return backendTranslation;

  const key = getCategoryTranslationKey(category);
  if (key) return t(key);

  return category.name;
}
