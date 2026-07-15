'use client';

import {
  calculateDistanceMeters,
  fuzzySuggestionThreshold,
  normalizeFuzzyText,
  scoreFuzzyMatch,
  t,
  type AppLocale,
  type GeoPoint,
  type PlaceType,
  type PlaceWithLatestReading,
  type QualityStatus,
} from '@veevalve/core/client';
import dynamic from 'next/dynamic';
import { PlaceCard } from '@veevalve/ui/web';
import { Suspense, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';

import { fetchPlaces } from '../lib/fetch-places';
import type { PlaceMetrics } from '../lib/fetch-place-metrics';
import type * as FetchPlaceMetricsModule from '../lib/fetch-place-metrics';
import type * as FetchPlacesByIdsModule from '../lib/fetch-places-by-ids';
import {
  readCachedFavoritePlaces,
  readFavoritePlaceIds,
  writeCachedFavoritePlaces,
  writeFavoritePlaceIds,
} from '../lib/favorites-storage';
import {
  readFavoriteStatusNotificationsEnabled,
  writeFavoriteStatusNotificationsEnabled,
} from '../lib/favorite-status-notifications-storage';
import {
  getFavoritePlacesFetchPolicy,
  getPlaceMetricsFetchPolicy,
  shouldRevalidateInitialPlaces,
} from '../lib/place-fetch-policy';
import {
  type AppTheme,
  writeMetricsUiPreferences,
  writePlacesBrowserPreferences,
  writeThemeUiPreferences,
} from '../lib/ui-preferences-storage';
import type * as WebPushClientModule from '../lib/web-push-client';

const LATEST_RESULTS_LIMIT = 10;
const SEARCH_RESULTS_LIMIT = 20;
const NEARBY_RESULTS_LIMIT = 12;
const SUGGESTION_LIMIT = 8;
const SEARCH_DEBOUNCE_MS = 180;
const FAVORITE_ACTION_MIN_PENDING_MS = 350;
const FAVORITES_UPDATED_VISIBLE_MS = 2_500;
const GEOLOCATION_TIMEOUT_MS = 10_000;
const GEOLOCATION_MAXIMUM_AGE_MS = 5 * 60 * 1_000;
const WEB_PUSH_VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY ?? '';
const CARD_STAGGER_CLASSES = [
  'fade-delay-0',
  'fade-delay-1',
  'fade-delay-2',
  'fade-delay-3',
  'fade-delay-4',
  'fade-delay-5',
  'fade-delay-6',
  'fade-delay-7',
  'fade-delay-8',
  'fade-delay-9',
  'fade-delay-10',
  'fade-delay-11',
] as const;

const getResultsLimit = (search?: string): number =>
  search?.trim() ? SEARCH_RESULTS_LIMIT : LATEST_RESULTS_LIMIT;

const getCardFadeDelayClass = (index: number): string => {
  const cappedIndex = Math.max(0, Math.min(index, CARD_STAGGER_CLASSES.length - 1));
  return CARD_STAGGER_CLASSES[cappedIndex] ?? CARD_STAGGER_CLASSES[0];
};

const runWhenIdle = (callback: () => void, timeout = 1_500): (() => void) => {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const browserWindow = window as Window;
  if (
    typeof browserWindow.requestIdleCallback === 'function' &&
    typeof browserWindow.cancelIdleCallback === 'function'
  ) {
    const idleHandle = browserWindow.requestIdleCallback(callback, { timeout });
    return () => browserWindow.cancelIdleCallback(idleHandle);
  }

  const timeoutHandle = globalThis.setTimeout(callback, Math.min(timeout, 250));
  return () => globalThis.clearTimeout(timeoutHandle);
};

const hasBrowserGeolocation = (): boolean =>
  typeof navigator !== 'undefined' && 'geolocation' in navigator;

const requestCurrentPosition = (): Promise<GeolocationPosition> => {
  if (!hasBrowserGeolocation()) {
    return Promise.reject(new Error('Geolocation is not supported by this browser.'));
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      maximumAge: GEOLOCATION_MAXIMUM_AGE_MS,
      timeout: GEOLOCATION_TIMEOUT_MS,
    });
  });
};

const toNearbySearchStatus = (error: unknown): NearbySearchStatus => {
  const code =
    typeof (error as { code?: unknown }).code === 'number'
      ? (error as { code: number }).code
      : undefined;

  if (code === 1) {
    return 'denied';
  }

  if (code === 2) {
    return 'unavailable';
  }

  if (code === 3) {
    return 'timeout';
  }

  return 'error';
};

let fetchPlacesByIdsModulePromise: Promise<typeof FetchPlacesByIdsModule> | undefined;
let fetchPlaceMetricsModulePromise: Promise<typeof FetchPlaceMetricsModule> | undefined;
let webPushClientModulePromise: Promise<typeof WebPushClientModule> | undefined;

const loadFetchPlacesByIdsModule = (): Promise<typeof FetchPlacesByIdsModule> => {
  if (!fetchPlacesByIdsModulePromise) {
    fetchPlacesByIdsModulePromise = import('../lib/fetch-places-by-ids');
  }

  return fetchPlacesByIdsModulePromise;
};

const loadFetchPlaceMetricsModule = (): Promise<typeof FetchPlaceMetricsModule> => {
  if (!fetchPlaceMetricsModulePromise) {
    fetchPlaceMetricsModulePromise = import('../lib/fetch-place-metrics');
  }

  return fetchPlaceMetricsModulePromise;
};

const loadWebPushClientModule = (): Promise<typeof WebPushClientModule> => {
  if (!webPushClientModulePromise) {
    webPushClientModulePromise = import('../lib/web-push-client');
  }

  return webPushClientModulePromise;
};

const AboutPanel = dynamic(() => import('./about-panel').then((module) => module.AboutPanel));

const MetricsPanel = dynamic(() => import('./metrics-panel').then((module) => module.MetricsPanel));

const AboutPanelPlaceholder = ({ locale }: { locale: AppLocale }) => {
  return (
    <div
      className="mt-4 rounded-2xl border border-emerald-100 bg-white/85 p-4 text-sm text-slate-700 dark:border-teal-400/20 dark:bg-slate-900/75 dark:text-slate-300"
      role="status"
      aria-live="polite"
    >
      <p className="font-semibold text-ink">
        {locale === 'et' ? 'Laadin infot...' : 'Loading info...'}
      </p>
      <div className="mt-3 space-y-2">
        <div className="h-3 w-11/12 rounded bg-emerald-100/80 dark:bg-teal-300/15" />
        <div className="h-3 w-10/12 rounded bg-emerald-100/80 dark:bg-teal-300/15" />
        <div className="h-3 w-8/12 rounded bg-emerald-100/80 dark:bg-teal-300/15" />
      </div>
    </div>
  );
};

const MetricsPanelPlaceholder = ({ locale }: { locale: AppLocale }) => {
  return (
    <div id="metrics-panel" className="mt-4" role="status" aria-live="polite">
      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
        {locale === 'et' ? 'Laadin mõõdikuid...' : 'Loading metrics...'}
      </p>
      <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="h-24 rounded-2xl border border-rose-200 bg-rose-50/80 dark:border-rose-400/30 dark:bg-rose-950/30" />
        <div className="h-24 rounded-2xl border border-emerald-100 bg-white/80 dark:border-teal-400/20 dark:bg-slate-900/75" />
        <div className="h-24 rounded-2xl border border-emerald-100 bg-white/80 dark:border-teal-400/20 dark:bg-slate-900/75" />
      </div>
    </div>
  );
};

interface PlacesBrowserProps {
  initialLocale: AppLocale;
  initialType: PlaceType | 'ALL';
  initialStatus: QualityStatus | 'ALL';
  initialSearch?: string;
  initialNearbySearchEnabled: boolean;
  initialFavoritesVisible: boolean;
  initialFavoriteIds: string[];
  initialPlaces: PlaceWithLatestReading[];
  initialNowIso: string;
  initialMetrics: PlaceMetrics;
  initialMetricsVisible: boolean;
  initialMetricsExpanded: boolean;
  initialTheme: AppTheme;
}

interface Suggestion {
  id: string;
  name: string;
  municipality: string;
  address?: string;
  matchedBy: 'name' | 'municipality' | 'address';
}

type NearbySearchStatus =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'unsupported'
  | 'denied'
  | 'unavailable'
  | 'timeout'
  | 'error';

type FavoritesRefreshStatus = 'idle' | 'updating' | 'updated';

interface FilterButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

const FilterButton = ({ label, active, onClick }: FilterButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex shrink-0 items-center rounded-full border px-2 py-0.5 text-xs font-medium transition sm:px-3 sm:py-1 sm:text-sm ${
        active
          ? 'border-emerald-700 bg-emerald-700 text-white dark:border-teal-300 dark:bg-teal-300 dark:text-slate-950'
          : 'border-emerald-100 bg-white text-ink hover:border-emerald-700 hover:text-emerald-800 dark:border-teal-400/25 dark:bg-slate-900 dark:hover:border-teal-300 dark:hover:text-teal-100'
      }`}
    >
      {label}
    </button>
  );
};

const highlightMatch = (value: string, search: string) => {
  const query = search.trim();
  if (!query) {
    return value;
  }

  const lowerValue = value.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const startIndex = lowerValue.indexOf(lowerQuery);

  if (startIndex === -1) {
    return value;
  }

  const endIndex = startIndex + query.length;

  return (
    <>
      {value.slice(0, startIndex)}
      <span className="font-semibold text-accent">{value.slice(startIndex, endIndex)}</span>
      {value.slice(endIndex)}
    </>
  );
};

const containsSearchTerm = (value: string | undefined, normalizedQuery: string): boolean => {
  if (!value || !normalizedQuery) {
    return false;
  }

  return normalizeFuzzyText(value).includes(normalizedQuery);
};

const formatMetricsDate = (value: string | null, locale: AppLocale): string => {
  if (!value) {
    return locale === 'et' ? 'Puudub' : 'Unavailable';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'et-EE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Tallinn',
  }).format(parsed);
};

const formatShare = (count: number, total: number): string => {
  if (total <= 0) {
    return '0%';
  }

  const percentage = (count / total) * 100;
  if (percentage >= 10) {
    return `${Math.round(percentage)}%`;
  }

  return `${percentage.toFixed(1)}%`;
};

const formatCompactDistance = (distanceMeters: number, locale: AppLocale): string => {
  const localeCode = locale === 'en' ? 'en-GB' : 'et-EE';

  if (distanceMeters < 1_000) {
    return `${new Intl.NumberFormat(localeCode, { maximumFractionDigits: 0 }).format(
      Math.max(0, Math.round(distanceMeters)),
    )} m`;
  }

  return `${new Intl.NumberFormat(localeCode, {
    maximumFractionDigits: distanceMeters < 10_000 ? 1 : 0,
  }).format(distanceMeters / 1_000)} km`;
};

const getNearbyStatusMessage = ({
  status,
  locale,
  isNearbySearchActive,
  accuracyLabel,
}: {
  status: NearbySearchStatus;
  locale: AppLocale;
  isNearbySearchActive: boolean;
  accuracyLabel: string | null;
}): string => {
  if (status === 'requesting') {
    return locale === 'et'
      ? 'Brauser küsib seadme asukohta.'
      : 'Waiting for browser location access.';
  }

  if (status === 'unsupported') {
    return locale === 'et'
      ? 'See brauser ei toeta seadme asukoha lugemist.'
      : 'This browser does not support device location.';
  }

  if (status === 'denied') {
    return locale === 'et'
      ? 'Asukoha ligipääs on brauseris blokeeritud.'
      : 'Location access is blocked in browser settings.';
  }

  if (status === 'timeout') {
    return locale === 'et'
      ? 'Asukoha leidmine võttis liiga kaua. Proovi uuesti.'
      : 'Finding your location took too long. Try again.';
  }

  if (status === 'unavailable') {
    return locale === 'et'
      ? 'Brauser ei saanud seadme asukohta kätte.'
      : 'The browser could not read your device location.';
  }

  if (status === 'error') {
    return locale === 'et'
      ? 'Asukoha lugemine ebaõnnestus. Proovi uuesti.'
      : 'Failed to read your location. Try again.';
  }

  if (isNearbySearchActive) {
    return locale === 'et'
      ? `Kuvan lähimaid kohti seadme asukoha järgi${accuracyLabel ? `, täpsus umbes ${accuracyLabel}` : ''}. Asukohta ei salvestata.`
      : `Showing nearby places from your device location${accuracyLabel ? `, accuracy about ${accuracyLabel}` : ''}. Location is not saved.`;
  }

  return locale === 'et'
    ? 'Otsingusoovitused uuenevad kirjutamise ajal. Vajuta "/", et otsingusse liikuda.'
    : 'Autocomplete suggestions update as you type. Press "/" to focus search.';
};

export const PlacesBrowser = ({
  initialLocale,
  initialType,
  initialStatus,
  initialSearch,
  initialNearbySearchEnabled,
  initialFavoritesVisible,
  initialFavoriteIds,
  initialPlaces,
  initialNowIso,
  initialMetrics,
  initialMetricsVisible,
  initialMetricsExpanded,
  initialTheme,
}: PlacesBrowserProps) => {
  const [locale, setLocale] = useState<AppLocale>(initialLocale);
  const [theme, setTheme] = useState<AppTheme>(initialTheme);
  const [systemPrefersDark, setSystemPrefersDark] = useState(false);
  const [typeFilter, setTypeFilter] = useState<PlaceType | 'ALL'>(initialType);
  const [statusFilter, setStatusFilter] = useState<QualityStatus | 'ALL'>(initialStatus);
  const [searchInput, setSearchInput] = useState(initialSearch ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState((initialSearch ?? '').trim());
  const [places, setPlaces] = useState<PlaceWithLatestReading[]>(
    initialPlaces.slice(0, getResultsLimit(initialSearch)),
  );
  const [loading, setLoading] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [nearbyStatus, setNearbyStatus] = useState<NearbySearchStatus>(
    initialNearbySearchEnabled ? 'requesting' : 'idle',
  );
  const [nearbySearchEnabled, setNearbySearchEnabled] = useState(initialNearbySearchEnabled);
  const [nearbyOrigin, setNearbyOrigin] = useState<GeoPoint | null>(null);
  const [nearbyAccuracyMeters, setNearbyAccuracyMeters] = useState<number | null>(null);
  const [referenceTimeIso, setReferenceTimeIso] = useState(initialNowIso);
  const [metrics, setMetrics] = useState<PlaceMetrics>(initialMetrics);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsLoaded, setMetricsLoaded] = useState(
    initialMetrics.totalEntries > 0 || initialMetrics.latestSourceUpdatedAt !== null,
  );
  const [metricsExpanded, setMetricsExpanded] = useState(initialMetricsExpanded);
  const [metricsVisible, setMetricsVisible] = useState(initialMetricsVisible);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>(initialFavoriteIds);
  const [favoritesVisible, setFavoritesVisible] = useState(initialFavoritesVisible);
  const [favoriteActionPendingIds, setFavoriteActionPendingIds] = useState<Set<string>>(new Set());
  const [favoritesHydrated, setFavoritesHydrated] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritePlaces, setFavoritePlaces] = useState<PlaceWithLatestReading[]>([]);
  const [favoritesRefreshStatus, setFavoritesRefreshStatus] =
    useState<FavoritesRefreshStatus>('idle');
  const [notificationsSupported, setNotificationsSupported] = useState(false);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>('default');
  const [statusNotificationsEnabled, setStatusNotificationsEnabled] = useState(false);
  const [notificationsPreferencesHydrated, setNotificationsPreferencesHydrated] = useState(false);
  const [notificationsSyncing, setNotificationsSyncing] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);

  const isInitialRender = useRef(true);
  const didRunMetricsPreferenceSyncRef = useRef(false);
  const didRunThemePreferenceSyncRef = useRef(false);
  const didRunPlacesBrowserPreferenceSyncRef = useRef(false);
  const didRunFavoriteIdsSyncRef = useRef(false);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const languageContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const favoriteActionTimeoutsRef = useRef<Map<string, number>>(new Map());
  const favoriteActionStartedAtRef = useRef<Map<string, number>>(new Map());
  const favoritePlacesRef = useRef<PlaceWithLatestReading[]>([]);
  const favoritesRefreshStatusTimeoutRef = useRef<number | null>(null);
  const suggestionsListId = useId();

  const clearFavoritesRefreshStatusTimeout = useCallback(() => {
    if (favoritesRefreshStatusTimeoutRef.current === null) {
      return;
    }

    window.clearTimeout(favoritesRefreshStatusTimeoutRef.current);
    favoritesRefreshStatusTimeoutRef.current = null;
  }, []);

  const showFavoritesUpdatedStatus = useCallback(() => {
    clearFavoritesRefreshStatusTimeout();
    setFavoritesRefreshStatus('updated');
    favoritesRefreshStatusTimeoutRef.current = window.setTimeout(() => {
      favoritesRefreshStatusTimeoutRef.current = null;
      setFavoritesRefreshStatus('idle');
    }, FAVORITES_UPDATED_VISIBLE_MS);
  }, [clearFavoritesRefreshStatusTimeout]);

  const clearFavoriteActionPending = useCallback((placeId: string) => {
    const existingTimeout = favoriteActionTimeoutsRef.current.get(placeId);
    if (typeof existingTimeout === 'number') {
      window.clearTimeout(existingTimeout);
    }

    const startedAt = favoriteActionStartedAtRef.current.get(placeId) ?? Date.now();
    const elapsedMs = Date.now() - startedAt;
    const delayMs = Math.max(0, FAVORITE_ACTION_MIN_PENDING_MS - elapsedMs);

    const timeoutId = window.setTimeout(() => {
      favoriteActionTimeoutsRef.current.delete(placeId);
      favoriteActionStartedAtRef.current.delete(placeId);
      setFavoriteActionPendingIds((currentIds) => {
        if (!currentIds.has(placeId)) {
          return currentIds;
        }

        const nextIds = new Set(currentIds);
        nextIds.delete(placeId);
        return nextIds;
      });
    }, delayMs);

    favoriteActionTimeoutsRef.current.set(placeId, timeoutId);
  }, []);

  useEffect(() => {
    favoritePlacesRef.current = favoritePlaces;
  }, [favoritePlaces]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      if (!shouldRevalidateInitialPlaces(initialNowIso)) {
        return;
      }
    }

    if (nearbyStatus === 'requesting') {
      return;
    }

    const controller = new AbortController();
    const nearbySearchActive = nearbyStatus === 'ready' && nearbyOrigin !== null;
    setLoading(true);
    setError(null);

    fetchPlaces({
      locale,
      type: typeFilter === 'ALL' ? undefined : typeFilter,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      search: nearbySearchActive ? undefined : debouncedSearch || undefined,
      sort: nearbySearchActive ? 'DISTANCE' : 'LATEST',
      nearLatitude: nearbySearchActive ? nearbyOrigin.latitude : undefined,
      nearLongitude: nearbySearchActive ? nearbyOrigin.longitude : undefined,
      limit: nearbySearchActive ? NEARBY_RESULTS_LIMIT : getResultsLimit(debouncedSearch),
      includeBadDetails: false,
      signal: controller.signal,
    })
      .then((nextPlaces) => {
        setPlaces(nextPlaces);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        setError(
          locale === 'et'
            ? 'Tulemuste laadimine ebaõnnestus. Proovi uuesti.'
            : 'Failed to load results. Please try again.',
        );
        console.error(fetchError);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [
    debouncedSearch,
    initialNowIso,
    locale,
    nearbyOrigin,
    nearbyStatus,
    statusFilter,
    typeFilter,
  ]);

  useEffect(() => {
    const syncReferenceTime = () => {
      setReferenceTimeIso(new Date().toISOString());
    };
    const syncVisibleReferenceTime = () => {
      if (document.visibilityState === 'visible') {
        syncReferenceTime();
      }
    };

    syncReferenceTime();
    const intervalId = window.setInterval(() => {
      syncReferenceTime();
    }, 60_000);
    window.addEventListener('focus', syncReferenceTime);
    window.addEventListener('pageshow', syncReferenceTime);
    document.addEventListener('visibilitychange', syncVisibleReferenceTime);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', syncReferenceTime);
      window.removeEventListener('pageshow', syncReferenceTime);
      document.removeEventListener('visibilitychange', syncVisibleReferenceTime);
    };
  }, []);

  useEffect(() => {
    setMetrics(initialMetrics);
    setMetricsLoaded(
      initialMetrics.totalEntries > 0 || initialMetrics.latestSourceUpdatedAt !== null,
    );
  }, [initialMetrics]);

  useEffect(() => {
    if (!metricsVisible || metricsLoaded) {
      return;
    }

    let cancelled = false;
    const placeMetricsFetchPolicy = getPlaceMetricsFetchPolicy();
    setMetricsLoading(true);
    void loadFetchPlaceMetricsModule()
      .then(({ fetchPlaceMetrics }) =>
        fetchPlaceMetrics({
          cacheMode: placeMetricsFetchPolicy.cacheMode,
          revalidateSeconds: placeMetricsFetchPolicy.revalidateSeconds,
        }),
      )
      .then((nextMetrics) => {
        if (cancelled) {
          return;
        }

        setMetrics(nextMetrics);
        setMetricsLoaded(true);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          console.error(fetchError);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMetricsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [metricsLoaded, metricsVisible]);

  useEffect(() => {
    if (!didRunMetricsPreferenceSyncRef.current) {
      didRunMetricsPreferenceSyncRef.current = true;
      return;
    }

    writeMetricsUiPreferences({
      metricsVisible,
      metricsExpanded,
    });
  }, [metricsExpanded, metricsVisible]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');

    if (!didRunThemePreferenceSyncRef.current) {
      didRunThemePreferenceSyncRef.current = true;
      return;
    }

    writeThemeUiPreferences({ theme });
  }, [theme]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const syncSystemTheme = () => {
      setSystemPrefersDark(mediaQuery.matches);
    };

    syncSystemTheme();
    mediaQuery.addEventListener('change', syncSystemTheme);
    return () => mediaQuery.removeEventListener('change', syncSystemTheme);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadWebPushClientModule()
      .then((webPushClient) => {
        if (cancelled) {
          return;
        }

        const supported = webPushClient.isWebPushSupported();
        setNotificationsSupported(supported);

        if (!supported) {
          setNotificationPermission('denied');
          setStatusNotificationsEnabled(false);
          setNotificationsPreferencesHydrated(true);
          return;
        }

        setNotificationPermission(webPushClient.readNotificationPermission());
        setStatusNotificationsEnabled(readFavoriteStatusNotificationsEnabled());
        setNotificationsPreferencesHydrated(true);
      })
      .catch((error) => {
        if (!cancelled) {
          console.error(error);
          setNotificationsSupported(false);
          setNotificationPermission('denied');
          setStatusNotificationsEnabled(false);
          setNotificationsPreferencesHydrated(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!notificationsSupported) {
      return;
    }

    const syncPermission = () => {
      void loadWebPushClientModule()
        .then((webPushClient) => {
          if (!webPushClient.isWebPushSupported()) {
            setNotificationPermission('denied');
            return;
          }

          setNotificationPermission(webPushClient.readNotificationPermission());
        })
        .catch((error) => {
          console.error(error);
        });
    };

    window.addEventListener('focus', syncPermission);
    document.addEventListener('visibilitychange', syncPermission);
    return () => {
      window.removeEventListener('focus', syncPermission);
      document.removeEventListener('visibilitychange', syncPermission);
    };
  }, [notificationsSupported]);

  useEffect(() => {
    if (!notificationsPreferencesHydrated) {
      return;
    }

    writeFavoriteStatusNotificationsEnabled(statusNotificationsEnabled);
  }, [notificationsPreferencesHydrated, statusNotificationsEnabled]);

  useEffect(() => {
    const nextFavoriteIds = readFavoritePlaceIds(initialFavoriteIds);
    setFavoriteIds(nextFavoriteIds);

    const cachedFavoritePlaces = readCachedFavoritePlaces(nextFavoriteIds);
    if (cachedFavoritePlaces.length > 0) {
      setFavoritePlaces(cachedFavoritePlaces);
    }

    if (nextFavoriteIds.length > 0 && initialFavoritesVisible) {
      setFavoritesLoading(true);
    }

    setFavoritesHydrated(true);
  }, [initialFavoriteIds, initialFavoritesVisible]);

  useEffect(() => {
    if (!favoritesHydrated) {
      return;
    }

    const favoriteIdsMatchInitial =
      favoriteIds.length === initialFavoriteIds.length &&
      favoriteIds.every((favoriteId, index) => favoriteId === initialFavoriteIds[index]);

    if (!didRunFavoriteIdsSyncRef.current) {
      didRunFavoriteIdsSyncRef.current = true;
      if (favoriteIdsMatchInitial) {
        return;
      }
    }

    writeFavoritePlaceIds(favoriteIds);
  }, [favoriteIds, favoritesHydrated, initialFavoriteIds]);

  useEffect(() => {
    if (!favoritesHydrated) {
      return;
    }

    if (favoriteIds.length === 0) {
      clearFavoritesRefreshStatusTimeout();
      setFavoritesRefreshStatus('idle');
      setFavoritePlaces([]);
      writeCachedFavoritePlaces([]);
      setFavoritesLoading(false);
      return;
    }

    if (!favoritesVisible) {
      clearFavoritesRefreshStatusTimeout();
      setFavoritesRefreshStatus('idle');
      setFavoritesLoading(false);
      return;
    }

    const controller = new AbortController();
    const favoritePlacesFetchPolicy = getFavoritePlacesFetchPolicy();
    const hadFavoritePlacesBeforeRefresh = favoritePlacesRef.current.length > 0;
    setFavoritesLoading(true);
    if (hadFavoritePlacesBeforeRefresh) {
      clearFavoritesRefreshStatusTimeout();
      setFavoritesRefreshStatus('updating');
    } else {
      setFavoritesRefreshStatus('idle');
    }

    void loadFetchPlacesByIdsModule()
      .then(({ fetchPlacesByIds }) =>
        fetchPlacesByIds({
          locale,
          ids: favoriteIds,
          signal: controller.signal,
          cacheMode: favoritePlacesFetchPolicy.cacheMode,
          revalidateSeconds: favoritePlacesFetchPolicy.revalidateSeconds,
          includeBadDetails: false,
        }),
      )
      .then((fetchedPlaces) => {
        if (controller.signal.aborted) {
          return;
        }

        const byId = new Map(fetchedPlaces.map((place) => [place.id, place] as const));
        const ordered = favoriteIds
          .map((id) => byId.get(id))
          .filter((place): place is PlaceWithLatestReading => Boolean(place));

        if (ordered.length === 0 && favoritePlacesRef.current.length > 0) {
          setFavoritesRefreshStatus('idle');
          return;
        }

        writeCachedFavoritePlaces(ordered);
        setFavoritePlaces(ordered);
        if (ordered.length > 0) {
          showFavoritesUpdatedStatus();
        } else {
          setFavoritesRefreshStatus('idle');
        }
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }
        clearFavoritesRefreshStatusTimeout();
        setFavoritesRefreshStatus('idle');
        console.error(fetchError);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setFavoritesLoading(false);
        }
      });

    return () => {
      controller.abort();
    };
  }, [
    clearFavoritesRefreshStatusTimeout,
    favoriteIds,
    favoritesHydrated,
    favoritesVisible,
    locale,
    showFavoritesUpdatedStatus,
  ]);

  useEffect(() => {
    if (!notificationsSupported || !notificationsPreferencesHydrated) {
      return;
    }

    let cancelled = false;

    const syncSubscription = async () => {
      setNotificationsSyncing(true);
      setNotificationsError(null);

      try {
        const webPushClient = await loadWebPushClientModule();
        const latestPermission = webPushClient.readNotificationPermission();
        if (!cancelled) {
          setNotificationPermission(latestPermission);
        }

        if (!statusNotificationsEnabled || latestPermission !== 'granted') {
          const existingSubscription = await webPushClient.getExistingSubscription();
          if (existingSubscription) {
            await webPushClient.removeWebPushSubscription(existingSubscription);
            await existingSubscription.unsubscribe();
          }

          if (latestPermission === 'denied' && !cancelled) {
            setStatusNotificationsEnabled(false);
          }
          return;
        }

        if (!WEB_PUSH_VAPID_PUBLIC_KEY.trim()) {
          throw new Error('Missing NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY');
        }

        const subscription =
          await webPushClient.ensureWebPushSubscription(WEB_PUSH_VAPID_PUBLIC_KEY);
        await webPushClient.syncWebPushSubscription({
          subscription,
          favoritePlaceIds: favoriteIds,
          locale,
        });
      } catch (error) {
        if (!cancelled) {
          setNotificationsError(
            locale === 'et'
              ? 'Teavituste seadistamine ebaõnnestus. Proovi uuesti.'
              : 'Failed to configure push alerts. Please try again.',
          );
        }
        console.error(error);
      } finally {
        if (!cancelled) {
          setNotificationsSyncing(false);
        }
      }
    };

    const cancelIdle = runWhenIdle(() => {
      void syncSubscription();
    }, 2_500);

    return () => {
      cancelled = true;
      cancelIdle();
    };
  }, [
    favoriteIds,
    locale,
    notificationsPreferencesHydrated,
    notificationsSupported,
    statusNotificationsEnabled,
  ]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setSuggestionsOpen(false);
        setActiveSuggestionIndex(-1);
      }
      if (languageContainerRef.current && !languageContainerRef.current.contains(target)) {
        setLanguageMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    return () => {
      for (const timeoutId of favoriteActionTimeoutsRef.current.values()) {
        window.clearTimeout(timeoutId);
      }

      favoriteActionTimeoutsRef.current.clear();
      favoriteActionStartedAtRef.current.clear();
      clearFavoritesRefreshStatusTimeout();
    };
  }, [clearFavoritesRefreshStatusTimeout]);

  useEffect(() => {
    const onSlashShortcut = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      const isTypingElement =
        tagName === 'input' || tagName === 'textarea' || target?.isContentEditable;

      if (isTypingElement) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();
      setSuggestionsOpen(true);
    };

    window.addEventListener('keydown', onSlashShortcut);
    return () => window.removeEventListener('keydown', onSlashShortcut);
  }, []);

  const searchQuery = searchInput.trim();
  const isNearbySearchActive = nearbyStatus === 'ready' && nearbyOrigin !== null;
  const visibleResultsLimit = isNearbySearchActive
    ? NEARBY_RESULTS_LIMIT
    : getResultsLimit(searchQuery);
  const visiblePlaces = places.slice(0, visibleResultsLimit);
  const shownResultsCount = visiblePlaces.length;
  const nearbyDistanceByPlaceId = useMemo(() => {
    if (!isNearbySearchActive || !nearbyOrigin) {
      return new Map<string, number>();
    }

    return new Map(
      places
        .map(
          (place) =>
            [
              place.id,
              calculateDistanceMeters(nearbyOrigin, {
                latitude: place.latitude,
                longitude: place.longitude,
              }),
            ] as const,
        )
        .filter(([, distanceMeters]) => Number.isFinite(distanceMeters)),
    );
  }, [isNearbySearchActive, nearbyOrigin, places]);
  const badShare = formatShare(metrics.badQualityEntries, metrics.totalEntries);
  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const favoriteCount = favoriteIds.length;
  const formattedFavoriteCount = new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'et-EE').format(
    favoriteCount,
  );
  const hasFavorites = favoriteCount > 0;
  const favoritesToggleLabel = favoritesVisible
    ? locale === 'et'
      ? 'Peida'
      : 'Hide'
    : locale === 'et'
      ? 'Näita'
      : 'Show';
  const favoritesRefreshLabel =
    favoritesRefreshStatus === 'updating'
      ? locale === 'et'
        ? 'Uuendan...'
        : 'Updating...'
      : favoritesRefreshStatus === 'updated'
        ? locale === 'et'
          ? 'Uuendatud'
          : 'Updated'
        : '';
  const showFavoritesRefreshStatus =
    favoritesVisible && favoritesRefreshStatus !== 'idle' && favoritePlaces.length > 0;
  const webPushConfigured = WEB_PUSH_VAPID_PUBLIC_KEY.trim().length > 0;
  const notificationsReady =
    notificationsSupported && webPushConfigured && notificationPermission === 'granted';
  const notificationsActive = notificationsReady && statusNotificationsEnabled;
  const notificationsButtonDisabled =
    !notificationsSupported ||
    !webPushConfigured ||
    notificationPermission === 'denied' ||
    notificationsSyncing;
  const favoritesNoticeSingleLine = notificationsSupported && notificationsActive;
  const notificationsButtonLabel = notificationsSyncing
    ? locale === 'et'
      ? 'Uuendan…'
      : 'Updating…'
    : notificationsActive
      ? locale === 'et'
        ? 'Teavitused sees'
        : 'Alerts on'
      : locale === 'et'
        ? 'Teavitused väljas'
        : 'Alerts off';
  const isDarkTheme = theme === 'dark' || (theme === 'system' && systemPrefersDark);
  const themeToggleLabel = isDarkTheme
    ? locale === 'et'
      ? 'Lülita hele teema sisse'
      : 'Switch to light theme'
    : locale === 'et'
      ? 'Lülita tume teema sisse'
      : 'Switch to dark theme';
  const nearbyAccuracyLabel =
    typeof nearbyAccuracyMeters === 'number' && Number.isFinite(nearbyAccuracyMeters)
      ? formatCompactDistance(nearbyAccuracyMeters, locale)
      : null;
  const nearbyButtonTitle =
    locale === 'et'
      ? 'Leia lähimad rannad ja basseinid seadme asukoha järgi'
      : 'Find nearest beaches and pools from your device location';
  const nearbyStatusMessage = getNearbyStatusMessage({
    status: nearbyStatus,
    locale,
    isNearbySearchActive,
    accuracyLabel: nearbyAccuracyLabel,
  });

  const clearNearbySearch = useCallback(() => {
    setNearbySearchEnabled(false);
    setNearbyOrigin(null);
    setNearbyAccuracyMeters(null);
    setNearbyStatus('idle');
  }, []);

  const requestNearbySearch = useCallback(async () => {
    setNearbySearchEnabled(true);

    if (!hasBrowserGeolocation()) {
      setNearbySearchEnabled(false);
      setNearbyOrigin(null);
      setNearbyAccuracyMeters(null);
      setNearbyStatus('unsupported');
      return;
    }

    setNearbyStatus('requesting');
    setNearbyOrigin(null);
    setNearbyAccuracyMeters(null);
    setError(null);
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);

    try {
      const position = await requestCurrentPosition();
      setSearchInput('');
      setDebouncedSearch('');
      setNearbyOrigin({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
      setNearbyAccuracyMeters(position.coords.accuracy);
      setNearbyStatus('ready');
    } catch (geolocationError) {
      const nextNearbyStatus = toNearbySearchStatus(geolocationError);
      setNearbySearchEnabled(false);
      setNearbyOrigin(null);
      setNearbyAccuracyMeters(null);
      setNearbyStatus(nextNearbyStatus);

      if (nextNearbyStatus === 'error') {
        console.error(geolocationError);
      }
    }
  }, []);

  useEffect(() => {
    if (!initialNearbySearchEnabled) {
      return;
    }

    void requestNearbySearch();
  }, [initialNearbySearchEnabled, requestNearbySearch]);

  useEffect(() => {
    if (!didRunPlacesBrowserPreferenceSyncRef.current) {
      didRunPlacesBrowserPreferenceSyncRef.current = true;
    } else {
      writePlacesBrowserPreferences({
        typeFilter,
        statusFilter,
        nearbySearchEnabled,
        favoritesVisible,
      });
    }

    const url = new URL(window.location.href);
    if (typeFilter === 'ALL') {
      url.searchParams.delete('type');
    } else {
      url.searchParams.set('type', typeFilter);
    }

    if (statusFilter === 'ALL') {
      url.searchParams.delete('status');
    } else {
      url.searchParams.set('status', statusFilter);
    }

    const nextUrl = `${url.pathname}${url.search}${url.hash}`;
    const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (nextUrl !== currentUrl) {
      window.history.replaceState(window.history.state, '', nextUrl);
    }
  }, [favoritesVisible, nearbySearchEnabled, statusFilter, typeFilter]);

  const toggleStatusNotifications = async () => {
    if (!webPushConfigured) {
      return;
    }

    let webPushClient: typeof WebPushClientModule;
    try {
      webPushClient = await loadWebPushClientModule();
    } catch (error) {
      console.error(error);
      setStatusNotificationsEnabled(false);
      return;
    }

    if (!webPushClient.isWebPushSupported()) {
      setNotificationsSupported(false);
      setNotificationPermission('denied');
      setStatusNotificationsEnabled(false);
      return;
    }

    const currentPermission = webPushClient.readNotificationPermission();
    setNotificationPermission(currentPermission);

    if (statusNotificationsEnabled) {
      setStatusNotificationsEnabled(false);
      return;
    }

    if (currentPermission === 'granted') {
      setStatusNotificationsEnabled(true);
      return;
    }

    if (currentPermission === 'default') {
      try {
        const nextPermission = await webPushClient.requestNotificationPermission();
        setNotificationPermission(nextPermission);
        setStatusNotificationsEnabled(nextPermission === 'granted');
      } catch {
        setStatusNotificationsEnabled(false);
      }
      return;
    }

    setStatusNotificationsEnabled(false);
  };

  const toggleFavoritesVisible = () => {
    const nextFavoritesVisible = !favoritesVisible;
    if (nextFavoritesVisible && favoriteIds.length > 0 && favoritePlaces.length === 0) {
      setFavoritesLoading(true);
    }

    setFavoritesVisible(nextFavoritesVisible);
  };

  const toggleFavorite = (placeId: string) => {
    if (favoriteActionPendingIds.has(placeId)) {
      return;
    }

    const isCurrentlyFavorite = favoriteIdSet.has(placeId);
    const optimisticPlace =
      places.find((place) => place.id === placeId) ??
      favoritePlaces.find((place) => place.id === placeId);

    favoriteActionStartedAtRef.current.set(placeId, Date.now());
    setFavoriteActionPendingIds((currentIds) => {
      const nextIds = new Set(currentIds);
      nextIds.add(placeId);
      return nextIds;
    });

    if (isCurrentlyFavorite) {
      setFavoriteIds((currentIds) => currentIds.filter((id) => id !== placeId));
      setFavoritePlaces((currentPlaces) => {
        const nextPlaces = currentPlaces.filter((place) => place.id !== placeId);
        writeCachedFavoritePlaces(nextPlaces);
        return nextPlaces;
      });
      return;
    }

    setFavoriteIds((currentIds) => [placeId, ...currentIds].slice(0, 50));
    if (optimisticPlace) {
      setFavoritePlaces((currentPlaces) => {
        if (currentPlaces.some((place) => place.id === placeId)) {
          return currentPlaces;
        }

        const nextPlaces = [optimisticPlace, ...currentPlaces].slice(0, 50);
        writeCachedFavoritePlaces(nextPlaces);
        return nextPlaces;
      });
    }
  };

  useEffect(() => {
    if (favoriteActionPendingIds.size === 0) {
      return;
    }

    if (favoritesLoading) {
      return;
    }

    for (const placeId of favoriteActionPendingIds) {
      clearFavoriteActionPending(placeId);
    }
  }, [clearFavoriteActionPending, favoriteActionPendingIds, favoritesLoading]);

  const suggestions = useMemo<Suggestion[]>(() => {
    if (!searchQuery) {
      return [];
    }

    const normalizedSearch = normalizeFuzzyText(searchQuery);
    if (!normalizedSearch) {
      return [];
    }

    const threshold = fuzzySuggestionThreshold(normalizedSearch);
    const rankedPlaces = places
      .map((place) => {
        const name = locale === 'en' ? place.nameEn : place.nameEt;
        const address =
          locale === 'en'
            ? (place.addressEn ?? place.addressEt)
            : (place.addressEt ?? place.addressEn);
        const nameScore = scoreFuzzyMatch({
          query: normalizedSearch,
          primary: name,
          secondary: place.municipality,
        });
        const addressScore = address
          ? scoreFuzzyMatch({
              query: normalizedSearch,
              primary: address,
            }) * 0.95
          : 0;
        const nameMatched = containsSearchTerm(name, normalizedSearch);
        const municipalityMatched = containsSearchTerm(place.municipality, normalizedSearch);
        const addressMatched = containsSearchTerm(address, normalizedSearch);

        const matchedBy: Suggestion['matchedBy'] = nameMatched
          ? 'name'
          : addressMatched
            ? 'address'
            : municipalityMatched
              ? 'municipality'
              : addressScore > nameScore
                ? 'address'
                : 'name';

        return {
          place,
          name,
          address,
          score: Math.max(nameScore, addressScore),
          matchedBy,
        };
      })
      .filter(({ score }) => score >= threshold)
      .sort((left, right) => right.score - left.score);

    const seen = new Set<string>();
    const nextSuggestions: Suggestion[] = [];

    for (const { place, name, address, matchedBy } of rankedPlaces) {
      const key = `${name}|${place.municipality}|${address ?? ''}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      nextSuggestions.push({
        id: place.id,
        name,
        municipality: place.municipality,
        address,
        matchedBy,
      });

      if (nextSuggestions.length >= SUGGESTION_LIMIT) {
        break;
      }
    }

    return nextSuggestions;
  }, [locale, places, searchQuery]);

  useEffect(() => {
    if (activeSuggestionIndex >= suggestions.length) {
      setActiveSuggestionIndex(-1);
    }
  }, [activeSuggestionIndex, suggestions.length]);

  const showSuggestions = suggestionsOpen && searchQuery.length > 0 && suggestions.length > 0;

  const applySuggestion = (suggestion: Suggestion) => {
    clearNearbySearch();
    setSearchInput(suggestion.name);
    setDebouncedSearch(suggestion.name);
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
    inputRef.current?.focus();
  };

  return (
    <main className="mx-auto max-w-6xl px-3 pb-16 pt-6 sm:px-4 sm:pt-8 md:px-8 md:pt-14">
      <section className="fade-up relative overflow-hidden rounded-3xl border border-emerald-200/70 bg-white/75 p-4 shadow-card backdrop-blur dark:border-teal-400/20 dark:bg-slate-950/60 sm:p-6 md:p-8">
        <div className="flex items-start justify-between gap-2">
          <p className="shrink-0 text-xs uppercase tracking-[0.08em] text-accent sm:text-sm sm:tracking-[0.14em]">
            {t('appName', locale)}
          </p>
          <div className="relative z-10 ml-auto min-w-0 max-w-[76%]" ref={languageContainerRef}>
            <div className="flex flex-nowrap items-center justify-end gap-1 whitespace-nowrap sm:gap-1.5">
              <button
                type="button"
                aria-pressed={aboutVisible}
                onClick={() => setAboutVisible((value) => !value)}
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full border text-xs font-semibold leading-none transition sm:h-7 sm:w-7 sm:text-sm ${
                  aboutVisible
                    ? 'border-emerald-700 bg-emerald-700 text-white dark:border-teal-300 dark:bg-teal-300 dark:text-slate-950'
                    : 'border-emerald-100 bg-white text-emerald-800 hover:border-emerald-700 dark:border-teal-400/30 dark:bg-slate-900 dark:text-teal-100 dark:hover:border-teal-300'
                }`}
                aria-label={locale === 'et' ? 'Ava info andmete kohta' : 'Open data info'}
                title={locale === 'et' ? 'Info' : 'About'}
              >
                ?
              </button>
              <button
                type="button"
                aria-pressed={isDarkTheme}
                onClick={() => setTheme(isDarkTheme ? 'light' : 'dark')}
                className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full border p-0.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-teal-300 dark:focus-visible:ring-offset-slate-950 sm:h-7 sm:w-12 ${
                  isDarkTheme
                    ? 'border-teal-300 bg-teal-300/20 text-teal-50'
                    : 'border-emerald-100 bg-white text-emerald-800 hover:border-emerald-700 dark:border-teal-400/30 dark:bg-slate-900 dark:text-teal-100 dark:hover:border-teal-300'
                }`}
                aria-label={themeToggleLabel}
                title={themeToggleLabel}
              >
                <span
                  aria-hidden="true"
                  className={`inline-flex h-4 w-4 items-center justify-center rounded-full shadow-sm transition sm:h-5 sm:w-5 ${
                    isDarkTheme
                      ? 'translate-x-5 bg-teal-200 text-slate-950 sm:translate-x-5'
                      : 'translate-x-0 bg-emerald-50 text-emerald-800 dark:bg-slate-800 dark:text-teal-100'
                  }`}
                >
                  {isDarkTheme ? (
                    <svg viewBox="0 0 20 20" className="h-3 w-3" focusable="false">
                      <path
                        d="M10 3.25a.75.75 0 0 1 .75.75v1.25a.75.75 0 0 1-1.5 0V4A.75.75 0 0 1 10 3.25Zm0 10a3.25 3.25 0 1 0 0-6.5 3.25 3.25 0 0 0 0 6.5Zm0 1.5a.75.75 0 0 1 .75.75V17a.75.75 0 0 1-1.5 0v-1.5a.75.75 0 0 1 .75-.75ZM4 9.25h1.25a.75.75 0 0 1 0 1.5H4a.75.75 0 0 1 0-1.5Zm10.75.75a.75.75 0 0 1 .75-.75H17a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1-.75-.75Zm-9.28-4.53a.75.75 0 0 1 1.06 0l.88.88a.75.75 0 1 1-1.06 1.06l-.88-.88a.75.75 0 0 1 0-1.06Zm7.12 7.12a.75.75 0 0 1 1.06 0l.88.88a.75.75 0 0 1-1.06 1.06l-.88-.88a.75.75 0 0 1 0-1.06Zm1.94-7.12a.75.75 0 0 1 0 1.06l-.88.88a.75.75 0 1 1-1.06-1.06l.88-.88a.75.75 0 0 1 1.06 0ZM7.41 12.59a.75.75 0 0 1 0 1.06l-.88.88a.75.75 0 0 1-1.06-1.06l.88-.88a.75.75 0 0 1 1.06 0Z"
                        fill="currentColor"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 20 20" className="h-3 w-3" focusable="false">
                      <path
                        d="M14.72 13.86A6.6 6.6 0 0 1 6.14 5.28 5.6 5.6 0 1 0 14.72 13.86Z"
                        fill="currentColor"
                      />
                    </svg>
                  )}
                </span>
              </button>
              <button
                type="button"
                aria-pressed={metricsVisible}
                onClick={() => setMetricsVisible((value) => !value)}
                className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold transition sm:px-3 sm:py-1 sm:text-xs ${
                  metricsVisible
                    ? 'border-emerald-700 bg-emerald-700 text-white dark:border-teal-300 dark:bg-teal-300 dark:text-slate-950'
                    : 'border-emerald-100 bg-white text-emerald-800 hover:border-emerald-700 dark:border-teal-400/30 dark:bg-slate-900 dark:text-teal-100 dark:hover:border-teal-300'
                }`}
              >
                {locale === 'et' ? 'Mõõdikud' : 'Metrics'}
              </button>
              <button
                type="button"
                aria-pressed={notificationsActive}
                aria-busy={notificationsSyncing}
                onClick={() => {
                  void toggleStatusNotifications();
                }}
                disabled={notificationsButtonDisabled}
                title={
                  !notificationsSupported
                    ? locale === 'et'
                      ? 'Brauser ei toeta teavitusi'
                      : 'This browser does not support notifications'
                    : !webPushConfigured
                      ? locale === 'et'
                        ? 'Teavituste võti puudub seadistusest'
                        : 'Push key is missing from configuration'
                      : notificationPermission === 'denied'
                        ? locale === 'et'
                          ? 'Teavitused on brauseris blokeeritud'
                          : 'Notifications are blocked in browser settings'
                        : locale === 'et'
                          ? 'Teavita lemmikute staatuse muutusest'
                          : 'Notify when favorite statuses change'
                }
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition sm:gap-1.5 sm:px-3 sm:py-1 sm:text-xs ${
                  notificationsActive
                    ? 'border-emerald-700 bg-emerald-700 text-white dark:border-teal-300 dark:bg-teal-300 dark:text-slate-950'
                    : 'border-emerald-100 bg-white text-emerald-800 hover:border-emerald-700 dark:border-teal-400/30 dark:bg-slate-900 dark:text-teal-100 dark:hover:border-teal-300'
                } disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400 dark:disabled:border-slate-700 dark:disabled:bg-slate-900/70 dark:disabled:text-slate-500`}
              >
                {notificationsSyncing ? (
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent"
                  />
                ) : null}
                <span className="sm:hidden">
                  {notificationsActive
                    ? locale === 'et'
                      ? 'Sees'
                      : 'On'
                    : locale === 'et'
                      ? 'Väljas'
                      : 'Off'}
                </span>
                <span className="hidden sm:inline">{notificationsButtonLabel}</span>
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setLanguageMenuOpen((value) => !value)}
                  aria-haspopup="menu"
                  aria-expanded={languageMenuOpen}
                  aria-controls="language-menu"
                  className="rounded-full border border-emerald-100 bg-white px-2 py-0.5 text-[11px] font-semibold text-emerald-800 transition hover:border-emerald-700 dark:border-teal-400/30 dark:bg-slate-900 dark:text-teal-100 dark:hover:border-teal-300 sm:px-3 sm:py-1 sm:text-xs"
                >
                  <span className="sm:hidden">{locale === 'et' ? 'ET' : 'EN'}</span>
                  <span className="hidden sm:inline">
                    {locale === 'et' ? 'Keel: Eesti' : 'Language: English'}
                  </span>
                </button>
                {languageMenuOpen ? (
                  <div
                    id="language-menu"
                    role="menu"
                    aria-label={locale === 'et' ? 'Keele valik' : 'Language selection'}
                    className="absolute right-0 z-10 mt-2 w-40 overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-card dark:border-teal-400/20 dark:bg-slate-900"
                  >
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={locale === 'et'}
                      onClick={() => {
                        setLocale('et');
                        setLanguageMenuOpen(false);
                      }}
                      className={`block w-full px-3 py-2 text-left text-sm transition ${
                        locale === 'et'
                          ? 'bg-emerald-50 font-semibold text-emerald-900 dark:bg-teal-300/15 dark:text-teal-50'
                          : 'text-ink hover:bg-emerald-50 dark:hover:bg-teal-300/10'
                      }`}
                    >
                      Eesti
                    </button>
                    <button
                      type="button"
                      role="menuitemradio"
                      aria-checked={locale === 'en'}
                      onClick={() => {
                        setLocale('en');
                        setLanguageMenuOpen(false);
                      }}
                      className={`block w-full px-3 py-2 text-left text-sm transition ${
                        locale === 'en'
                          ? 'bg-emerald-50 font-semibold text-emerald-900 dark:bg-teal-300/15 dark:text-teal-50'
                          : 'text-ink hover:bg-emerald-50 dark:hover:bg-teal-300/10'
                      }`}
                    >
                      English
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            {notificationsError ? (
              <p className="mt-1 text-right text-[11px] text-rose-600">{notificationsError}</p>
            ) : null}
          </div>
        </div>
        <h1 className="mt-3 text-3xl leading-tight text-ink sm:text-4xl md:text-5xl">
          {locale === 'et'
            ? 'Vee kvaliteet randades ja basseinides'
            : 'Water quality for beaches and pools'}
        </h1>

        {aboutVisible ? (
          <Suspense fallback={<AboutPanelPlaceholder locale={locale} />}>
            <AboutPanel locale={locale} />
          </Suspense>
        ) : null}

        {metricsVisible ? (
          <Suspense fallback={<MetricsPanelPlaceholder locale={locale} />}>
            <MetricsPanel
              locale={locale}
              metrics={metrics}
              metricsLoading={metricsLoading}
              metricsExpanded={metricsExpanded}
              badShare={badShare}
              formattedLatestUpdate={formatMetricsDate(metrics.latestSourceUpdatedAt, locale)}
              onToggleExpanded={() => setMetricsExpanded((value) => !value)}
            />
          </Suspense>
        ) : null}
        <div className="mt-5 max-w-3xl" ref={searchContainerRef}>
          <label htmlFor="place-search" className="sr-only">
            {locale === 'et' ? 'Otsi ujumiskohta' : 'Search swimming places'}
          </label>
          <div className="relative">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-slate-500"
            >
              <path
                d="M13.442 12.032l4.263 4.263-1.41 1.41-4.264-4.263a7 7 0 1 1 1.41-1.41zM8.5 13A4.5 4.5 0 1 0 8.5 4a4.5 4.5 0 0 0 0 9z"
                fill="currentColor"
              />
            </svg>
            <input
              id="place-search"
              ref={inputRef}
              type="text"
              value={searchInput}
              onFocus={() => setSuggestionsOpen(true)}
              onChange={(event) => {
                clearNearbySearch();
                setSearchInput(event.target.value);
                setSuggestionsOpen(true);
                setActiveSuggestionIndex(-1);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' && suggestions.length > 0) {
                  event.preventDefault();
                  setSuggestionsOpen(true);
                  setActiveSuggestionIndex((value) =>
                    value >= suggestions.length - 1 ? 0 : value + 1,
                  );
                  return;
                }

                if (event.key === 'ArrowUp' && suggestions.length > 0) {
                  event.preventDefault();
                  setSuggestionsOpen(true);
                  setActiveSuggestionIndex((value) =>
                    value <= 0 ? suggestions.length - 1 : value - 1,
                  );
                  return;
                }

                if (
                  event.key === 'Enter' &&
                  activeSuggestionIndex >= 0 &&
                  activeSuggestionIndex < suggestions.length
                ) {
                  event.preventDefault();
                  const selectedSuggestion = suggestions[activeSuggestionIndex];
                  if (selectedSuggestion) {
                    applySuggestion(selectedSuggestion);
                  }
                  return;
                }

                if (event.key === 'Enter') {
                  event.preventDefault();
                  setSuggestionsOpen(false);
                  setActiveSuggestionIndex(-1);
                  return;
                }

                if (event.key === 'Escape') {
                  setSuggestionsOpen(false);
                  setActiveSuggestionIndex(-1);
                }
              }}
              placeholder={
                locale === 'et'
                  ? 'Otsi koha nime või omavalitsust...'
                  : 'Search place or municipality...'
              }
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showSuggestions}
              aria-controls={showSuggestions ? suggestionsListId : undefined}
              aria-activedescendant={
                showSuggestions && activeSuggestionIndex >= 0
                  ? `${suggestionsListId}-${activeSuggestionIndex}`
                  : undefined
              }
              className="h-14 w-full rounded-2xl border border-emerald-200 bg-white pl-12 pr-24 text-base text-ink shadow-card outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-emerald-200 dark:border-teal-400/25 dark:bg-slate-950/80 dark:placeholder:text-slate-500 dark:focus:ring-teal-300/30 sm:pr-28"
            />
            <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
              {searchInput ? (
                <button
                  type="button"
                  onClick={() => {
                    clearNearbySearch();
                    setSearchInput('');
                    setDebouncedSearch('');
                    setSuggestionsOpen(false);
                    setActiveSuggestionIndex(-1);
                    inputRef.current?.focus();
                  }}
                  aria-label={locale === 'et' ? 'Puhasta otsing' : 'Clear search'}
                  title={locale === 'et' ? 'Puhasta otsing' : 'Clear search'}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50/80 text-sm font-semibold leading-none text-accent shadow-sm transition hover:border-accent hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:border-teal-400/25 dark:bg-slate-900 dark:hover:border-teal-300 dark:hover:bg-slate-800 dark:focus-visible:ring-teal-300 dark:focus-visible:ring-offset-slate-950"
                >
                  <span aria-hidden="true">×</span>
                </button>
              ) : (
                <kbd className="rounded border border-emerald-100 bg-emerald-50 px-1.5 py-0.5 text-[11px] text-slate-500 dark:border-teal-400/20 dark:bg-slate-900 dark:text-slate-400 sm:px-2">
                  /
                </kbd>
              )}
              <button
                type="button"
                onClick={() => {
                  void requestNearbySearch();
                }}
                disabled={nearbyStatus === 'requesting'}
                aria-label={nearbyButtonTitle}
                aria-pressed={isNearbySearchActive}
                aria-busy={nearbyStatus === 'requesting'}
                title={nearbyButtonTitle}
                className={`inline-flex h-8 w-8 items-center justify-center rounded border text-emerald-700 transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-teal-300 dark:focus-visible:ring-offset-slate-950 ${
                  nearbyStatus === 'requesting'
                    ? 'cursor-wait border-emerald-200 bg-emerald-50 text-accent dark:border-teal-400/25 dark:bg-slate-900'
                    : isNearbySearchActive
                      ? 'border-emerald-500 bg-emerald-100 text-emerald-900 shadow-inner hover:border-emerald-600 hover:bg-emerald-100 active:bg-emerald-200 dark:border-teal-300 dark:bg-teal-300/20 dark:text-teal-50 dark:hover:bg-teal-300/25'
                      : 'border-emerald-100 bg-emerald-50 text-slate-500 hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800 active:bg-emerald-200 dark:border-teal-400/20 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-teal-300 dark:hover:bg-slate-800 dark:hover:text-teal-100'
                }`}
              >
                {nearbyStatus === 'requesting' ? (
                  <span
                    aria-hidden="true"
                    className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
                  />
                ) : (
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="h-4.5 w-4.5">
                    <path
                      d="M10 2a1 1 0 0 1 1 1v1.07A6.02 6.02 0 0 1 15.93 9H17a1 1 0 1 1 0 2h-1.07A6.02 6.02 0 0 1 11 15.93V17a1 1 0 1 1-2 0v-1.07A6.02 6.02 0 0 1 4.07 11H3a1 1 0 1 1 0-2h1.07A6.02 6.02 0 0 1 9 4.07V3a1 1 0 0 1 1-1Zm0 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0 2.25A1.75 1.75 0 1 1 10 11.75 1.75 1.75 0 0 1 10 8.25Z"
                      fill="currentColor"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {showSuggestions ? (
            <ul
              id={suggestionsListId}
              role="listbox"
              className="mt-2 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-card dark:border-teal-400/20 dark:bg-slate-900"
            >
              {suggestions.map((suggestion, index) => (
                <li
                  key={`${suggestion.id}-${suggestion.name}`}
                  id={`${suggestionsListId}-${index}`}
                  role="option"
                  aria-selected={index === activeSuggestionIndex}
                >
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applySuggestion(suggestion)}
                    className={`block w-full px-4 py-3 text-left transition ${
                      index === activeSuggestionIndex
                        ? 'bg-emerald-50 dark:bg-teal-300/15'
                        : 'hover:bg-emerald-50 dark:hover:bg-teal-300/10'
                    }`}
                  >
                    <p className="text-sm text-ink">
                      {highlightMatch(suggestion.name, searchQuery)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {suggestion.matchedBy === 'address' && suggestion.address
                        ? highlightMatch(suggestion.address, searchQuery)
                        : highlightMatch(suggestion.municipality, searchQuery)}
                    </p>
                    {suggestion.matchedBy !== 'name' ? (
                      <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-slate-400 dark:text-slate-500">
                        {suggestion.matchedBy === 'address'
                          ? locale === 'et'
                            ? 'Aadressi vaste'
                            : 'Address match'
                          : locale === 'et'
                            ? 'Omavalitsuse vaste'
                            : 'Municipality match'}
                      </p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <div
            className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400"
            aria-live="polite"
          >
            <p>{nearbyStatusMessage}</p>
            {nearbyStatus !== 'idle' ? (
              <button
                type="button"
                onClick={clearNearbySearch}
                className="font-semibold text-accent underline decoration-dotted underline-offset-2 hover:text-emerald-700 dark:hover:text-teal-200"
              >
                {locale === 'et' ? 'Lõpeta' : 'Clear'}
              </button>
            ) : null}
          </div>
        </div>

        <div className="-mx-0.5 mt-5 overflow-x-auto pb-1">
          <div className="flex min-w-max items-center gap-1 px-0.5">
            <FilterButton
              label={locale === 'et' ? 'Kõik kohad' : 'All places'}
              active={typeFilter === 'ALL' && statusFilter === 'ALL'}
              onClick={() => {
                setTypeFilter('ALL');
                setStatusFilter('ALL');
              }}
            />
            <FilterButton
              label={t('beaches', locale)}
              active={typeFilter === 'BEACH'}
              onClick={() => setTypeFilter((value) => (value === 'BEACH' ? 'ALL' : 'BEACH'))}
            />
            <FilterButton
              label={t('pools', locale)}
              active={typeFilter === 'POOL'}
              onClick={() => setTypeFilter((value) => (value === 'POOL' ? 'ALL' : 'POOL'))}
            />
            <FilterButton
              label={t('qualityGood', locale)}
              active={statusFilter === 'GOOD'}
              onClick={() => setStatusFilter((value) => (value === 'GOOD' ? 'ALL' : 'GOOD'))}
            />
            <FilterButton
              label={t('qualityBad', locale)}
              active={statusFilter === 'BAD'}
              onClick={() => setStatusFilter((value) => (value === 'BAD' ? 'ALL' : 'BAD'))}
            />
          </div>
        </div>
      </section>

      {hasFavorites ? (
        <section id="favorite-places" className="mt-8" aria-live="polite">
          <div className="mb-3 flex min-h-9 items-center gap-3">
            <button
              type="button"
              onClick={toggleFavoritesVisible}
              aria-pressed={favoritesVisible}
              aria-controls="favorite-places-content"
              aria-expanded={favoritesVisible}
              className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:focus-visible:ring-teal-300 dark:focus-visible:ring-offset-slate-950 ${
                favoritesVisible
                  ? 'border-emerald-700 bg-emerald-700 text-white dark:border-teal-300 dark:bg-teal-300 dark:text-slate-950'
                  : 'border-emerald-100 bg-white text-emerald-800 hover:border-emerald-700 dark:border-teal-400/25 dark:bg-slate-900 dark:text-teal-100 dark:hover:border-teal-300'
              }`}
            >
              <span aria-hidden="true" className="text-base leading-none">
                ★
              </span>
              <span>{t('favorites', locale)}</span>
              <span
                aria-live="polite"
                className={`rounded-full px-2 py-0.5 text-xs ${
                  favoritesVisible
                    ? 'bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950'
                    : 'bg-emerald-50 text-slate-700 dark:bg-teal-300/10 dark:text-slate-200'
                }`}
              >
                {formattedFavoriteCount}
              </span>
              <span className="text-xs">{favoritesToggleLabel}</span>
            </button>
            <div
              className="ml-auto flex h-8 w-32 shrink-0 items-center justify-end"
              aria-live="polite"
            >
              {showFavoritesRefreshStatus ? (
                <span
                  role="status"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs font-medium ${
                    favoritesRefreshStatus === 'updating'
                      ? 'border-emerald-200 bg-white/85 text-emerald-800 dark:border-teal-400/20 dark:bg-slate-900/85 dark:text-teal-100'
                      : 'border-emerald-100 bg-emerald-50 text-emerald-800 dark:border-teal-400/20 dark:bg-teal-300/10 dark:text-teal-100'
                  }`}
                >
                  {favoritesRefreshStatus === 'updating' ? (
                    <span className="relative inline-flex h-3 w-3" aria-hidden="true">
                      <span className="absolute inset-0 rounded-full border-2 border-emerald-100 dark:border-teal-300/20" />
                      <span className="absolute inset-0 animate-spin rounded-full border-2 border-accent border-r-transparent" />
                    </span>
                  ) : null}
                  <span>{favoritesRefreshLabel}</span>
                </span>
              ) : null}
            </div>
          </div>

          {favoritesVisible ? (
            <div id="favorite-places-content">
              <p
                className={`mb-3 text-xs text-slate-500 dark:text-slate-400 ${favoritesNoticeSingleLine ? 'whitespace-nowrap' : ''}`}
              >
                {!webPushConfigured
                  ? locale === 'et'
                    ? 'Brauseri tõuketeavitused pole veel seadistatud.'
                    : 'Browser push notifications are not configured yet.'
                  : notificationsSupported
                    ? notificationsActive
                      ? locale === 'et'
                        ? 'Tõuketeavitused sees: lemmikute muutused ka suletud lehel.'
                        : 'Push alerts on: favorite changes are sent when closed.'
                      : locale === 'et'
                        ? 'Lülita tõuketeavitused sisse, et saada märguanne lemmikute staatuse muutustest.'
                        : 'Enable push alerts to get notified when favorite statuses change.'
                    : locale === 'et'
                      ? 'Sinu brauser ei toeta tõuketeavitusi.'
                      : 'Your browser does not support push notifications.'}
              </p>
              {!favoritesHydrated || (favoritesLoading && favoritePlaces.length === 0) ? (
                <div role="status" className="grid min-h-[12rem] gap-4 md:grid-cols-2">
                  <div className="animate-pulse rounded-xl border border-emerald-100 bg-card p-4 dark:border-teal-400/20" />
                  <div className="hidden animate-pulse rounded-xl border border-emerald-100 bg-card p-4 dark:border-teal-400/20 md:block" />
                  <span className="sr-only">
                    {locale === 'et' ? 'Laadin lemmikuid...' : 'Loading favorites...'}
                  </span>
                </div>
              ) : favoritePlaces.length === 0 ? (
                <div className="flex min-h-[12rem] items-center rounded-xl border border-emerald-100 bg-card p-4 text-sm text-slate-600 dark:border-teal-400/20 dark:text-slate-300">
                  {locale === 'et'
                    ? 'Lemmikuid ei õnnestunud hetkel laadida.'
                    : 'Could not load favorites right now.'}
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {favoritePlaces.map((place, index) => (
                    <div
                      className={`fade-up ${getCardFadeDelayClass(index)}`}
                      key={`favorite-${place.id}`}
                    >
                      <PlaceCard
                        place={place}
                        locale={locale}
                        referenceTimeIso={referenceTimeIso}
                        isFavorite
                        favoriteUpdating={favoriteActionPendingIds.has(place.id)}
                        onToggleFavorite={toggleFavorite}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div id="favorite-places-content" hidden />
          )}
        </section>
      ) : null}

      <section className="mt-8">
        <h2 className="sr-only">{locale === 'et' ? 'Tulemused' : 'Results'}</h2>
        <div className="relative mb-3 pr-10 text-xs text-slate-500 dark:text-slate-400">
          <p>
            {isNearbySearchActive
              ? locale === 'et'
                ? `Kuvan ${shownResultsCount} lähimat kohta seadme asukoha järgi.`
                : `Showing ${shownResultsCount} closest places near your device location.`
              : searchQuery
                ? locale === 'et'
                  ? `Otsing: "${searchQuery}". Näitan ${shownResultsCount} tulemust (maksimaalselt ${visibleResultsLimit}).`
                  : `Search: "${searchQuery}". Showing ${shownResultsCount} of up to ${visibleResultsLimit} results.`
                : locale === 'et'
                  ? `Kuvan ${shownResultsCount} viimati uuendatud kohta.`
                  : `Showing ${shownResultsCount} most recently updated places.`}
          </p>
          {loading ? (
            <div
              role="status"
              aria-live="polite"
              className="pointer-events-none absolute right-0 top-1/2 inline-flex -translate-y-1/2 items-center rounded-full border border-emerald-200 bg-white/85 px-2 py-1 shadow-sm dark:border-teal-400/20 dark:bg-slate-900/85"
            >
              <span className="relative inline-flex h-4 w-4" aria-hidden="true">
                <span className="absolute inset-0 rounded-full border-2 border-emerald-100 dark:border-teal-300/20" />
                <span className="absolute inset-0 animate-spin rounded-full border-2 border-accent border-r-transparent" />
                <span className="absolute left-1/2 top-1/2 h-1 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/70" />
              </span>
              <span className="sr-only">
                {locale === 'et' ? 'Uuendan tulemusi...' : 'Updating results...'}
              </span>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700 dark:border-rose-400/30 dark:bg-rose-950/30 dark:text-rose-200">
            {error}
          </div>
        ) : null}

        {places.length === 0 && !loading ? (
          <div className="rounded-xl border border-emerald-100 bg-card p-4 text-sm text-slate-600 dark:border-teal-400/20 dark:text-slate-300">
            {locale === 'et'
              ? 'Sobivaid kohti ei leitud valitud filtritega.'
              : 'No places found with the selected filters.'}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {visiblePlaces.map((place, index) => (
              <div className={`fade-up ${getCardFadeDelayClass(index)}`} key={place.id}>
                <PlaceCard
                  place={place}
                  locale={locale}
                  referenceTimeIso={referenceTimeIso}
                  isFavorite={favoriteIdSet.has(place.id)}
                  favoriteUpdating={favoriteActionPendingIds.has(place.id)}
                  distanceMeters={nearbyDistanceByPlaceId.get(place.id)}
                  onToggleFavorite={toggleFavorite}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};
