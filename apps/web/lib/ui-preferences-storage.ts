import type { PlaceType, QualityStatus } from '@veevalve/core/client';

export interface MetricsUiPreferences {
  metricsVisible: boolean;
  metricsExpanded: boolean;
}

export interface PlacesBrowserPreferences {
  typeFilter: PlaceType | 'ALL';
  statusFilter: QualityStatus | 'ALL';
  nearbySearchEnabled: boolean;
  favoritesVisible: boolean;
}

export type AppTheme = 'system' | 'light' | 'dark';

export interface ThemeUiPreferences {
  theme: AppTheme;
}

const METRICS_PREFERENCES_KEY = 'veevalve.metrics_ui.v1';
export const METRICS_PREFERENCES_COOKIE_NAME = '__Host-veevalve.metrics_ui.v1';
const PLACES_BROWSER_PREFERENCES_KEY = 'veevalve.places_browser.v1';
export const PLACES_BROWSER_PREFERENCES_COOKIE_NAME = '__Host-veevalve.places_browser.v1';
const THEME_PREFERENCES_KEY = 'veevalve.theme_ui.v1';
export const THEME_PREFERENCES_COOKIE_NAME = '__Host-veevalve.theme_ui.v1';

const DEFAULT_METRICS_UI_PREFERENCES: MetricsUiPreferences = {
  metricsVisible: false,
  metricsExpanded: false,
};

const DEFAULT_PLACES_BROWSER_PREFERENCES: PlacesBrowserPreferences = {
  typeFilter: 'ALL',
  statusFilter: 'ALL',
  nearbySearchEnabled: false,
  favoritesVisible: true,
};

const DEFAULT_THEME_UI_PREFERENCES: ThemeUiPreferences = {
  theme: 'system',
};

const normalizeTypeFilter = (value: unknown): PlaceType | 'ALL' => {
  return value === 'BEACH' || value === 'POOL' || value === 'ALL' ? value : 'ALL';
};

const normalizeStatusFilter = (value: unknown): QualityStatus | 'ALL' => {
  return value === 'GOOD' || value === 'BAD' || value === 'UNKNOWN' || value === 'ALL'
    ? value
    : 'ALL';
};

export const normalizeMetricsUiPreferences = (value: unknown): MetricsUiPreferences => {
  if (!value || typeof value !== 'object') {
    return DEFAULT_METRICS_UI_PREFERENCES;
  }

  const candidate = value as Partial<MetricsUiPreferences>;
  return {
    metricsVisible:
      typeof candidate.metricsVisible === 'boolean'
        ? candidate.metricsVisible
        : DEFAULT_METRICS_UI_PREFERENCES.metricsVisible,
    metricsExpanded:
      typeof candidate.metricsExpanded === 'boolean'
        ? candidate.metricsExpanded
        : DEFAULT_METRICS_UI_PREFERENCES.metricsExpanded,
  };
};

export const normalizePlacesBrowserPreferences = (value: unknown): PlacesBrowserPreferences => {
  if (!value || typeof value !== 'object') {
    return DEFAULT_PLACES_BROWSER_PREFERENCES;
  }

  const candidate = value as Partial<PlacesBrowserPreferences>;
  return {
    typeFilter: normalizeTypeFilter(candidate.typeFilter),
    statusFilter: normalizeStatusFilter(candidate.statusFilter),
    nearbySearchEnabled:
      typeof candidate.nearbySearchEnabled === 'boolean'
        ? candidate.nearbySearchEnabled
        : DEFAULT_PLACES_BROWSER_PREFERENCES.nearbySearchEnabled,
    favoritesVisible:
      typeof candidate.favoritesVisible === 'boolean'
        ? candidate.favoritesVisible
        : DEFAULT_PLACES_BROWSER_PREFERENCES.favoritesVisible,
  };
};

export const normalizeThemeUiPreferences = (value: unknown): ThemeUiPreferences => {
  if (!value || typeof value !== 'object') {
    return DEFAULT_THEME_UI_PREFERENCES;
  }

  const candidate = value as Partial<ThemeUiPreferences>;
  const theme =
    candidate.theme === 'system' || candidate.theme === 'light' || candidate.theme === 'dark'
      ? candidate.theme
      : DEFAULT_THEME_UI_PREFERENCES.theme;

  return {
    theme,
  };
};

export const parseMetricsUiPreferences = (serialized?: string): MetricsUiPreferences => {
  if (!serialized) {
    return DEFAULT_METRICS_UI_PREFERENCES;
  }

  try {
    return normalizeMetricsUiPreferences(JSON.parse(serialized));
  } catch {
    try {
      return normalizeMetricsUiPreferences(JSON.parse(decodeURIComponent(serialized)));
    } catch {
      return DEFAULT_METRICS_UI_PREFERENCES;
    }
  }
};

export const parsePlacesBrowserPreferences = (serialized?: string): PlacesBrowserPreferences => {
  if (!serialized) {
    return DEFAULT_PLACES_BROWSER_PREFERENCES;
  }

  try {
    return normalizePlacesBrowserPreferences(JSON.parse(serialized));
  } catch {
    try {
      return normalizePlacesBrowserPreferences(JSON.parse(decodeURIComponent(serialized)));
    } catch {
      return DEFAULT_PLACES_BROWSER_PREFERENCES;
    }
  }
};

export const parseThemeUiPreferences = (serialized?: string): ThemeUiPreferences => {
  if (!serialized) {
    return DEFAULT_THEME_UI_PREFERENCES;
  }

  try {
    return normalizeThemeUiPreferences(JSON.parse(serialized));
  } catch {
    try {
      return normalizeThemeUiPreferences(JSON.parse(decodeURIComponent(serialized)));
    } catch {
      return DEFAULT_THEME_UI_PREFERENCES;
    }
  }
};

const writeBrowserPreferenceCookie = (payload: {
  metricsUi?: MetricsUiPreferences;
  placesBrowser?: PlacesBrowserPreferences;
  themeUi?: ThemeUiPreferences;
}): void => {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') {
    return;
  }

  try {
    void fetch('/api/preferences', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      credentials: 'same-origin',
      keepalive: true,
    }).catch(() => {
      // Ignore sync failures; the in-memory UI state has already updated.
    });
  } catch {
    // Ignore storage failures (private mode / blocked requests).
  }
};

export const readThemeUiPreferences = (): ThemeUiPreferences => {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME_UI_PREFERENCES;
  }

  try {
    const raw = window.localStorage.getItem(THEME_PREFERENCES_KEY);
    if (!raw) {
      return DEFAULT_THEME_UI_PREFERENCES;
    }

    return parseThemeUiPreferences(raw);
  } catch {
    return DEFAULT_THEME_UI_PREFERENCES;
  }
};

export const writeThemeUiPreferences = (preferences: ThemeUiPreferences): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = normalizeThemeUiPreferences(preferences);
  try {
    window.localStorage.setItem(THEME_PREFERENCES_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage failures (private mode / quota).
  }

  writeBrowserPreferenceCookie({ themeUi: normalized });
};

export const readMetricsUiPreferences = (): MetricsUiPreferences => {
  if (typeof window === 'undefined') {
    return DEFAULT_METRICS_UI_PREFERENCES;
  }

  try {
    const raw = window.localStorage.getItem(METRICS_PREFERENCES_KEY);
    if (!raw) {
      return DEFAULT_METRICS_UI_PREFERENCES;
    }

    return parseMetricsUiPreferences(raw);
  } catch {
    return DEFAULT_METRICS_UI_PREFERENCES;
  }
};

export const writeMetricsUiPreferences = (preferences: MetricsUiPreferences): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = normalizeMetricsUiPreferences(preferences);
  try {
    window.localStorage.setItem(METRICS_PREFERENCES_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage failures (private mode / quota).
  }

  writeBrowserPreferenceCookie({ metricsUi: normalized });
};

export const readPlacesBrowserPreferences = (): PlacesBrowserPreferences => {
  if (typeof window === 'undefined') {
    return DEFAULT_PLACES_BROWSER_PREFERENCES;
  }

  try {
    const raw = window.localStorage.getItem(PLACES_BROWSER_PREFERENCES_KEY);
    if (!raw) {
      return DEFAULT_PLACES_BROWSER_PREFERENCES;
    }

    return parsePlacesBrowserPreferences(raw);
  } catch {
    return DEFAULT_PLACES_BROWSER_PREFERENCES;
  }
};

export const writePlacesBrowserPreferences = (preferences: PlacesBrowserPreferences): void => {
  if (typeof window === 'undefined') {
    return;
  }

  const normalized = normalizePlacesBrowserPreferences(preferences);
  try {
    window.localStorage.setItem(PLACES_BROWSER_PREFERENCES_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage failures (private mode / quota).
  }

  writeBrowserPreferenceCookie({ placesBrowser: normalized });
};
