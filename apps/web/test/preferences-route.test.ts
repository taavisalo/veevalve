import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';

import { PUT } from '../app/api/preferences/route';
import {
  parsePlacesBrowserPreferences,
  PLACES_BROWSER_PREFERENCES_COOKIE_NAME,
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
    });
  });
});
