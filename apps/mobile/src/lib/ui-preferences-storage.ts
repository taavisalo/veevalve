import AsyncStorage from '@react-native-async-storage/async-storage';

export interface MetricsUiPreferences {
  metricsVisible: boolean;
  metricsExpanded: boolean;
}

const METRICS_PREFERENCES_KEY = 'veevalve.metrics_ui.v1';

const DEFAULT_METRICS_UI_PREFERENCES: MetricsUiPreferences = {
  metricsVisible: false,
  metricsExpanded: false,
};

const normalizeMetricsUiPreferences = (value: unknown): MetricsUiPreferences => {
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

export const readMetricsUiPreferences = async (): Promise<MetricsUiPreferences> => {
  try {
    const raw = await AsyncStorage.getItem(METRICS_PREFERENCES_KEY);
    if (!raw) {
      return DEFAULT_METRICS_UI_PREFERENCES;
    }

    return normalizeMetricsUiPreferences(JSON.parse(raw));
  } catch {
    return DEFAULT_METRICS_UI_PREFERENCES;
  }
};

export const writeMetricsUiPreferences = async (
  preferences: MetricsUiPreferences,
): Promise<void> => {
  const normalized = normalizeMetricsUiPreferences(preferences);

  try {
    await AsyncStorage.setItem(METRICS_PREFERENCES_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage failures.
  }
};
