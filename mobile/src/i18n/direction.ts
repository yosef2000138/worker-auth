import type { Direction, LanguageCode } from './types';

export function isRtlLanguage(code: LanguageCode) {
  return code === 'ar' || code === 'he';
}

export function directionForLanguage(code: LanguageCode): Direction {
  return isRtlLanguage(code) ? 'rtl' : 'ltr';
}

export function localeForLanguage(code: LanguageCode) {
  if (code === 'ar') return 'ar';
  if (code === 'he') return 'he';
  if (code === 'ru') return 'ru';
  return 'en';
}

export function textAlignForLanguage(code: LanguageCode) {
  return isRtlLanguage(code) ? 'right' : 'left';
}

export function writingDirectionForLanguage(code: LanguageCode): Direction {
  return directionForLanguage(code);
}
