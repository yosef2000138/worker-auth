import {
  apiErrorCodeTranslationKeys,
  apiErrorMessageTranslationKeys,
  TranslationKey,
} from '@/i18n';

type Translator = (key: TranslationKey, values?: Record<string, string | number>) => string;
type ErrorLike = {
  code?: string;
  message?: string;
  status?: number;
};

function asErrorLike(error: unknown): ErrorLike {
  return typeof error === 'object' && error !== null ? error as ErrorLike : {};
}

function normalizeMessage(message?: string) {
  return message?.trim().replace(/\.$/, '') ?? '';
}

export function localizedApiErrorMessage(
  error: unknown,
  t: Translator,
  fallbackKey: TranslationKey = 'errors.generic',
) {
  const err = asErrorLike(error);

  if (err.code && apiErrorCodeTranslationKeys[err.code]) {
    return t(apiErrorCodeTranslationKeys[err.code]);
  }

  const normalized = normalizeMessage(err.message);
  const messageKey = apiErrorMessageTranslationKeys[normalized] ?? apiErrorMessageTranslationKeys[err.message ?? ''];
  if (messageKey) return t(messageKey);

  if (err.status === 401) return t('errors.unauthorized');
  if (err.status === 403) return t('errors.forbidden');
  if (err.status === 404) return t('errors.notFound');
  if (err.status === 422) return t('errors.validation');
  if (err.status === 429) return t('errors.tooManyRequests');

  const message = err.message ?? '';
  if (/timeout|network|connection/i.test(message)) return t('errors.network');
  return t(fallbackKey);
}
