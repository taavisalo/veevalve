import { type NextRequest, NextResponse } from 'next/server';

import { buildWebContentSecurityPolicy } from './lib/security-headers';

const isProduction = process.env.NODE_ENV === 'production';

const createNonce = (): string => {
  return btoa(crypto.randomUUID());
};

export function proxy(request: NextRequest) {
  const nonce = createNonce();
  const contentSecurityPolicy = buildWebContentSecurityPolicy({
    isProduction,
    nonce,
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|sw.js).*)'],
};
