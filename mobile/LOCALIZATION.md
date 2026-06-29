# Localization Rules

English in `src/i18n/locales/en.ts` is the source dictionary. Every key added there must be added to `ar.ts`, `he.ts`, and `ru.ts`.

For every new screen or component:

1. Use `useAppLocalization()` or `useTranslation()` and translation keys, not hardcoded user-facing text.
2. Add new keys to all four locale files before shipping the screen.
3. Use shared RTL-aware UI components such as `LocalizedText`, `Row`, `EmptyState`, `ErrorState`, and `StatusBadge`.
4. Use centralized helpers for status labels, category names, dates, numbers, currency, and plurals.
5. Keep backend enum values, IDs, routes, URLs, and environment-variable names unchanged.
6. Run `npm run i18n:check` and `npx tsc --noEmit`.
7. Manually check at least one RTL language and one LTR language.

Category IDs always come from the backend. Display names should go through `getLocalizedCategoryName(category, language.code, t)`.
