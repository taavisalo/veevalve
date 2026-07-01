'use client';

import { useEffect } from 'react';

const isServiceWorkerEnabled = process.env.NODE_ENV === 'production';

const runWhenIdle = (callback: () => void): (() => void) => {
  if (typeof window.requestIdleCallback === 'function') {
    const handle = window.requestIdleCallback(callback, { timeout: 2_000 });
    return () => window.cancelIdleCallback(handle);
  }

  const timeoutId = window.setTimeout(callback, 1_000);
  return () => window.clearTimeout(timeoutId);
};

export const ServiceWorkerRegistration = () => {
  useEffect(() => {
    if (!isServiceWorkerEnabled || !('serviceWorker' in navigator)) {
      return;
    }

    let cancelIdle: (() => void) | undefined;

    const registerServiceWorker = () => {
      cancelIdle = runWhenIdle(() => {
        void navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((error: unknown) => {
          console.warn('Service worker registration failed.', error);
        });
      });
    };

    if (document.readyState === 'complete') {
      registerServiceWorker();
      return () => {
        cancelIdle?.();
      };
    }

    window.addEventListener('load', registerServiceWorker, { once: true });
    return () => {
      window.removeEventListener('load', registerServiceWorker);
      cancelIdle?.();
    };
  }, []);

  return null;
};
