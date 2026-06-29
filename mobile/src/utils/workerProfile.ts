import { WorkerProfile } from '@/types';
import type { TranslationKey } from '@/i18n';

const PHONE_REGEX = /^(\+?[1-9]\d{7,14}|0\d{8,14})$/;

export function workerCategoryIds(worker?: WorkerProfile | null) {
  return (worker?.categories ?? [])
    .map(item => ('category' in item ? item.category.id : item.id))
    .filter(Boolean);
}

export function isWorkerProfileComplete(worker?: WorkerProfile | null) {
  if (!worker) return false;

  const hourlyRate = Number(worker.hourlyRate ?? 0);
  const yearsExp = Number(worker.yearsExp ?? 0);
  const fullName = worker.user?.fullName?.trim() ?? '';
  const phone = worker.user?.phone?.trim() ?? '';

  return (
    fullName.length >= 2 &&
    PHONE_REGEX.test(phone) &&
    Boolean(worker.user?.avatarUrl) &&
    Boolean(worker.bio?.trim() && worker.bio.trim().length >= 20) &&
    Number.isFinite(yearsExp) &&
    yearsExp >= 0 &&
    Number.isFinite(hourlyRate) &&
    hourlyRate > 0 &&
    workerCategoryIds(worker).length > 0 &&
    (worker.availability?.length ?? 0) > 0
  );
}

export function workerProfileMissingItems(worker?: WorkerProfile | null) {
  const labelByKey: Partial<Record<TranslationKey, string>> = {
    'profile.missing.workerProfile': 'Worker profile',
    'profile.missing.fullName': 'Full name',
    'profile.missing.phone': 'Phone number',
    'profile.missing.photo': 'Profile photo',
    'profile.missing.bio': 'Short bio',
    'profile.missing.hourlyRate': 'Hourly rate',
    'profile.missing.categories': 'Work categories',
    'profile.missing.availability': 'Availability',
  };

  return workerProfileMissingItemKeys(worker).map(key => labelByKey[key] ?? key);
}

export function workerProfileMissingItemKeys(worker?: WorkerProfile | null): TranslationKey[] {
  if (!worker) return ['profile.missing.workerProfile'];

  const missing: TranslationKey[] = [];
  const hourlyRate = Number(worker.hourlyRate ?? 0);
  const phone = worker.user?.phone?.trim() ?? '';

  if ((worker.user?.fullName?.trim() ?? '').length < 2) missing.push('profile.missing.fullName');
  if (!PHONE_REGEX.test(phone)) missing.push('profile.missing.phone');
  if (!worker.user?.avatarUrl) missing.push('profile.missing.photo');
  if (!worker.bio?.trim() || worker.bio.trim().length < 20) missing.push('profile.missing.bio');
  if (!Number.isFinite(hourlyRate) || hourlyRate <= 0) missing.push('profile.missing.hourlyRate');
  if (workerCategoryIds(worker).length === 0) missing.push('profile.missing.categories');
  if ((worker.availability?.length ?? 0) === 0) missing.push('profile.missing.availability');

  return missing;
}
