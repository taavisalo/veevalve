const resolveApiBaseUrl = (): string => {
  const rawBaseUrl =
    process.env.API_BASE_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    'http://localhost:3001';
  return rawBaseUrl.replace(/\/+$/, '');
};

const urlBase64ToArrayBuffer = (base64String: string): ArrayBuffer => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(normalized);
  const outputArray = new Uint8Array(rawData.length);

  for (let index = 0; index < rawData.length; index += 1) {
    outputArray[index] = rawData.charCodeAt(index);
  }

  return outputArray.buffer;
};

const normalizeFavoriteIds = (favoriteIds: string[]): string[] => {
  const unique = new Set<string>();
  for (const rawId of favoriteIds) {
    const id = rawId.trim();
    if (!id) {
      continue;
    }

    unique.add(id);
    if (unique.size >= 50) {
      break;
    }
  }

  return [...unique];
};

const assertSupported = (): void => {
  if (!isWebPushSupported()) {
    throw new Error('Web push is not supported in this browser.');
  }
};

const toSerializableSubscription = (subscription: PushSubscription) => {
  const json = subscription.toJSON();
  const endpoint = json.endpoint?.trim();
  const p256dh = json.keys?.p256dh?.trim();
  const auth = json.keys?.auth?.trim();

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Push subscription is missing required endpoint or keys.');
  }

  return {
    endpoint,
    keys: {
      p256dh,
      auth,
    },
    expirationTime: subscription.expirationTime ?? null,
  };
};

export const isWebPushSupported = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window
  );
};

export const readNotificationPermission = (): NotificationPermission => {
  if (!isWebPushSupported()) {
    return 'denied';
  }

  return window.Notification.permission;
};

export const requestNotificationPermission = async (): Promise<NotificationPermission> => {
  assertSupported();
  return window.Notification.requestPermission();
};

export const getExistingSubscription = async (): Promise<PushSubscription | null> => {
  assertSupported();
  const registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) {
    return null;
  }

  return registration.pushManager.getSubscription();
};

export const ensureWebPushSubscription = async (
  vapidPublicKey: string,
): Promise<PushSubscription> => {
  assertSupported();

  const trimmedKey = vapidPublicKey.trim();
  if (!trimmedKey) {
    throw new Error('Missing NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY.');
  }

  let registration = await navigator.serviceWorker.getRegistration('/');
  if (!registration) {
    registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
  }

  const existing = await registration.pushManager.getSubscription();
  if (existing) {
    return existing;
  }

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToArrayBuffer(trimmedKey),
  });
};

export const syncWebPushSubscription = async (input: {
  subscription: PushSubscription;
  favoritePlaceIds: string[];
  locale: 'et' | 'en';
}): Promise<void> => {
  const apiBaseUrl = resolveApiBaseUrl();
  const response = await fetch(`${apiBaseUrl}/web-push/subscriptions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({
      subscription: toSerializableSubscription(input.subscription),
      favoritePlaceIds: normalizeFavoriteIds(input.favoritePlaceIds),
      locale: input.locale,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to sync web push subscription: ${response.status}`);
  }
};

export const removeWebPushSubscription = async (
  subscription: PushSubscription,
): Promise<void> => {
  const endpoint = subscription.endpoint?.trim();
  if (!endpoint) {
    return;
  }

  const apiBaseUrl = resolveApiBaseUrl();
  await fetch(`${apiBaseUrl}/web-push/subscriptions`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify({ endpoint }),
  });
};
