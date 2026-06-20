import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import {
  FAVORITE_PLACE_IDS_COOKIE_NAME,
  normalizeFavoritePlaceIds,
} from '../../../lib/favorites-storage';
import {
  METRICS_PREFERENCES_COOKIE_NAME,
  normalizeMetricsUiPreferences,
  normalizePlacesBrowserPreferences,
  normalizeThemeUiPreferences,
  PLACES_BROWSER_PREFERENCES_COOKIE_NAME,
  THEME_PREFERENCES_COOKIE_NAME,
} from '../../../lib/ui-preferences-storage';

const PREFERENCE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

const serializePreferenceCookieValue = (value: unknown): string => JSON.stringify(value);

export const PUT = async (request: NextRequest) => {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 });
  }

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Invalid preferences payload.' }, { status: 400 });
  }

  const candidate = payload as {
    favoritePlaceIds?: unknown;
    metricsUi?: unknown;
    placesBrowser?: unknown;
    themeUi?: unknown;
  };
  const response = NextResponse.json({ ok: true });
  const cookieOptions = {
    httpOnly: true,
    maxAge: PREFERENCE_COOKIE_MAX_AGE_SECONDS,
    path: '/',
    sameSite: 'lax' as const,
    secure: true,
  };
  let wrotePreference = false;

  if ('metricsUi' in candidate) {
    response.cookies.set({
      name: METRICS_PREFERENCES_COOKIE_NAME,
      value: serializePreferenceCookieValue(normalizeMetricsUiPreferences(candidate.metricsUi)),
      ...cookieOptions,
    });
    wrotePreference = true;
  }

  if ('placesBrowser' in candidate) {
    response.cookies.set({
      name: PLACES_BROWSER_PREFERENCES_COOKIE_NAME,
      value: serializePreferenceCookieValue(
        normalizePlacesBrowserPreferences(candidate.placesBrowser),
      ),
      ...cookieOptions,
    });
    wrotePreference = true;
  }

  if ('themeUi' in candidate) {
    response.cookies.set({
      name: THEME_PREFERENCES_COOKIE_NAME,
      value: serializePreferenceCookieValue(normalizeThemeUiPreferences(candidate.themeUi)),
      ...cookieOptions,
    });
    wrotePreference = true;
  }

  if ('favoritePlaceIds' in candidate) {
    response.cookies.set({
      name: FAVORITE_PLACE_IDS_COOKIE_NAME,
      value: serializePreferenceCookieValue(normalizeFavoritePlaceIds(candidate.favoritePlaceIds)),
      ...cookieOptions,
    });
    wrotePreference = true;
  }

  if (!wrotePreference) {
    return NextResponse.json({ error: 'No supported preferences supplied.' }, { status: 400 });
  }

  response.headers.set('Cache-Control', 'no-store');
  return response;
};
