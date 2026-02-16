import type { AppLocale } from '../types';

export const defaultLocale: AppLocale = 'et';

export const translations = {
  et: {
    appName: 'VeeValve',
    subtitle: 'Avalike randade ja basseinide vee kvaliteet Eestis',
    qualityGood: 'Hea',
    qualityBad: 'Halb',
    qualityUnknown: 'Teadmata',
    beaches: 'Rannad',
    pools: 'Basseinid',
    favorites: 'Lemmikud',
    notifications: 'Teavitused',
    locationAlerts: 'Asukohapõhised teavitused',
    signIn: 'Logi sisse',
    signOut: 'Logi välja',
  },
  en: {
    appName: 'VeeValve',
    subtitle: 'Water quality for public beaches and pools in Estonia',
    qualityGood: 'Good',
    qualityBad: 'Bad',
    qualityUnknown: 'Unknown',
    beaches: 'Beaches',
    pools: 'Pools',
    favorites: 'Favorites',
    notifications: 'Notifications',
    locationAlerts: 'Location alerts',
    signIn: 'Sign in',
    signOut: 'Sign out',
  },
} as const;

export type TranslationKey = keyof (typeof translations)['et'];
