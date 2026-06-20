import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { PUT } from '../app/api/preferences/route';
import { FAVORITE_PLACE_IDS_COOKIE_NAME, parseFavoritePlaceIds } from '../lib/favorites-storage';
import {
  parsePlacesBrowserPreferences,
  parseThemeUiPreferences,
  PLACES_BROWSER_PREFERENCES_COOKIE_NAME,
  THEME_PREFERENCES_COOKIE_NAME,
} from '../lib/ui-preferences-storage';

const createPreferencesRequest = ({ payload }: { payload: unknown }): NextRequest =>
  new NextRequest('http://localhost/api/preferences', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

describe('preferences route', () => {
  it('sets secure __Host prefixed HttpOnly lax cookies', async () => {
    const response = await PUT(
      createPreferencesRequest({
        payload: {
          placesBrowser: {
            typeFilter: 'POOL',
            statusFilter: 'BAD',
            nearbySearchEnabled: true,
            favoritesVisible: false,
          },
        },
      }),
    );

    const setCookie = response.headers.get('set-cookie') ?? '';
    const cookieValue = setCookie
      .split(';')[0]
      ?.slice(`${PLACES_BROWSER_PREFERENCES_COOKIE_NAME}=`.length);

    expect(response.status).toBe(200);
    expect(setCookie).toContain(`${PLACES_BROWSER_PREFERENCES_COOKIE_NAME}=`);
    expect(PLACES_BROWSER_PREFERENCES_COOKIE_NAME).toMatch(/^__Host-/);
    expect(setCookie).not.toContain('%257B');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Max-Age=31536000');
    expect(setCookie).not.toContain('Domain=');
    expect(parsePlacesBrowserPreferences(cookieValue)).toEqual({
      typeFilter: 'POOL',
      statusFilter: 'BAD',
      nearbySearchEnabled: true,
      favoritesVisible: false,
    });
  });

  it('sets secure __Host prefixed favorite ID cookies', async () => {
    const response = await PUT(
      createPreferencesRequest({
        payload: {
          favoritePlaceIds: ['place-1', 'place-2', 'place-1', ''],
        },
      }),
    );

    const setCookie = response.headers.get('set-cookie') ?? '';
    const cookieValue = setCookie.split(';')[0]?.slice(`${FAVORITE_PLACE_IDS_COOKIE_NAME}=`.length);

    expect(response.status).toBe(200);
    expect(setCookie).toContain(`${FAVORITE_PLACE_IDS_COOKIE_NAME}=`);
    expect(FAVORITE_PLACE_IDS_COOKIE_NAME).toMatch(/^__Host-/);
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Max-Age=31536000');
    expect(setCookie).not.toContain('Domain=');
    expect(parseFavoritePlaceIds(cookieValue)).toEqual(['place-1', 'place-2']);
  });

  it('sets secure __Host prefixed theme cookies', async () => {
    const response = await PUT(
      createPreferencesRequest({
        payload: {
          themeUi: {
            theme: 'dark',
          },
        },
      }),
    );

    const setCookie = response.headers.get('set-cookie') ?? '';
    const cookieValue = setCookie.split(';')[0]?.slice(`${THEME_PREFERENCES_COOKIE_NAME}=`.length);

    expect(response.status).toBe(200);
    expect(setCookie).toContain(`${THEME_PREFERENCES_COOKIE_NAME}=`);
    expect(THEME_PREFERENCES_COOKIE_NAME).toMatch(/^__Host-/);
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=lax');
    expect(setCookie).toContain('Path=/');
    expect(setCookie).toContain('Max-Age=31536000');
    expect(setCookie).not.toContain('Domain=');
    expect(parseThemeUiPreferences(cookieValue)).toEqual({ theme: 'dark' });
  });
});
