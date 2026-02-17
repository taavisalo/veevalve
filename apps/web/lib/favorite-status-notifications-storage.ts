const FAVORITE_STATUS_NOTIFICATIONS_KEY = 'veevalve.favorite_status_notifications.v1';

export const readFavoriteStatusNotificationsEnabled = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  try {
    return window.localStorage.getItem(FAVORITE_STATUS_NOTIFICATIONS_KEY) === '1';
  } catch {
    return false;
  }
};

export const writeFavoriteStatusNotificationsEnabled = (enabled: boolean): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (!enabled) {
      window.localStorage.removeItem(FAVORITE_STATUS_NOTIFICATIONS_KEY);
      return;
    }

    window.localStorage.setItem(FAVORITE_STATUS_NOTIFICATIONS_KEY, '1');
  } catch {
    // Ignore storage failures (private mode / quota).
  }
};
