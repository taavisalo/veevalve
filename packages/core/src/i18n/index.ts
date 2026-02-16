import { defaultLocale, translations, type TranslationKey } from './translations';
import type { AppLocale } from '../types';

export const getSupportedLocales = (): AppLocale[] => ['et', 'en'];

export const isSupportedLocale = (value: string): value is AppLocale =>
  getSupportedLocales().includes(value as AppLocale);

export const t = (key: TranslationKey, locale: AppLocale = defaultLocale): string => {
  return translations[locale][key] ?? translations[defaultLocale][key] ?? key;
};
