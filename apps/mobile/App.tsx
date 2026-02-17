import {
  fuzzySuggestionThreshold,
  normalizeFuzzyText,
  scoreFuzzyMatch,
  t,
  type AppLocale,
  type PlaceType,
  type PlaceWithLatestReading,
  type QualityStatus,
} from '@veevalve/core/client';
import { NativePlaceCard } from '@veevalve/ui/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ToggleRow } from './src/components/toggle-row';
import { fetchPlaceMetrics, fetchPlaces, fetchPlacesByIds, type PlaceMetrics } from './src/lib/fetch-places';
import { readFavoritePlaceIds, writeFavoritePlaceIds } from './src/lib/favorites-storage';
import { readMetricsUiPreferences, writeMetricsUiPreferences } from './src/lib/ui-preferences-storage';

const LATEST_RESULTS_LIMIT = 10;
const SEARCH_RESULTS_LIMIT = 20;
const SUGGESTION_LIMIT = 8;
const SEARCH_DEBOUNCE_MS = 180;
const TERVISEAMET_DATA_URL = 'https://vtiav.sm.ee/index.php/?active_tab_id=A';

const getResultsLimit = (search?: string): number =>
  search?.trim() ? SEARCH_RESULTS_LIMIT : LATEST_RESULTS_LIMIT;

interface Suggestion {
  id: string;
  name: string;
  municipality: string;
  address?: string;
  matchedBy: 'name' | 'municipality' | 'address';
}

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

const App = () => {
  const [locale, setLocale] = useState<AppLocale>('et');
  const [typeFilter, setTypeFilter] = useState<PlaceType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<QualityStatus | 'ALL'>('ALL');
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [qualityAlertsEnabled, setQualityAlertsEnabled] = useState(true);
  const [locationAlertsEnabled, setLocationAlertsEnabled] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [places, setPlaces] = useState<PlaceWithLatestReading[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [referenceTimeIso, setReferenceTimeIso] = useState(() => new Date().toISOString());
  const [metrics, setMetrics] = useState<PlaceMetrics | null>(null);
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  const [metricsVisible, setMetricsVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [metricsPreferencesHydrated, setMetricsPreferencesHydrated] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoritesHydrated, setFavoritesHydrated] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritePlaces, setFavoritePlaces] = useState<PlaceWithLatestReading[]>([]);

  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();
    const currentResultsLimit = getResultsLimit(debouncedSearch);

    setLoading(true);
    setError(null);

    fetchPlaces({
      locale,
      type: typeFilter === 'ALL' ? undefined : typeFilter,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      search: debouncedSearch || undefined,
      limit: currentResultsLimit,
      signal: controller.signal,
    })
      .then((nextPlaces) => {
        setPlaces(nextPlaces.slice(0, currentResultsLimit));
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

    return () => {
      controller.abort();
    };
  }, [debouncedSearch, locale, statusFilter, typeFilter]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setReferenceTimeIso(new Date().toISOString());
    }, 60_000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    fetchPlaceMetrics({ signal: controller.signal })
      .then((nextMetrics) => {
        setMetrics(nextMetrics);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        console.error(fetchError);
      });

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    readMetricsUiPreferences()
      .then((preferences) => {
        if (!mounted) {
          return;
        }

        setMetricsVisible(preferences.metricsVisible);
        setMetricsExpanded(preferences.metricsExpanded);
      })
      .finally(() => {
        if (mounted) {
          setMetricsPreferencesHydrated(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!metricsPreferencesHydrated) {
      return;
    }

    void writeMetricsUiPreferences({
      metricsVisible,
      metricsExpanded,
    });
  }, [metricsExpanded, metricsPreferencesHydrated, metricsVisible]);

  useEffect(() => {
    let mounted = true;

    readFavoritePlaceIds()
      .then((storedIds) => {
        if (!mounted) {
          return;
        }

        setFavoriteIds(storedIds);
      })
      .finally(() => {
        if (mounted) {
          setFavoritesHydrated(true);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!favoritesHydrated) {
      return;
    }

    void writeFavoritePlaceIds(favoriteIds);
  }, [favoriteIds, favoritesHydrated]);

  useEffect(() => {
    if (favoriteIds.length === 0) {
      setFavoritePlaces([]);
      setFavoritesLoading(false);
      return;
    }

    const controller = new AbortController();
    setFavoritesLoading(true);

    fetchPlacesByIds({
      locale,
      ids: favoriteIds,
      signal: controller.signal,
    })
      .then((fetchedPlaces) => {
        if (controller.signal.aborted) {
          return;
        }

        const byId = new Map(fetchedPlaces.map((place) => [place.id, place] as const));
        const ordered = favoriteIds
          .map((id) => byId.get(id))
          .filter((place): place is PlaceWithLatestReading => Boolean(place));
        setFavoritePlaces(ordered);
      })
      .catch((fetchError: unknown) => {
        if (controller.signal.aborted) {
          return;
        }

        setFavoritePlaces([]);
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
  }, [favoriteIds, locale]);

  const searchQuery = searchInput.trim();
  const visibleResultsLimit = getResultsLimit(searchQuery);
  const shownResultsCount = places.length;
  const badShare = formatShare(metrics?.badQualityEntries ?? 0, metrics?.totalEntries ?? 0);
  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const hasFavorites = favoriteIds.length > 0;

  const toggleMetricsVisible = () => {
    setMetricsVisible((value) => !value);
  };

  const toggleMetricsExpanded = () => {
    setMetricsExpanded((value) => !value);
  };

  const openAboutSourceLink = async () => {
    try {
      await Linking.openURL(TERVISEAMET_DATA_URL);
    } catch (openUrlError) {
      console.error(openUrlError);
    }
  };

  const toggleFavorite = (placeId: string) => {
    setFavoriteIds((currentIds) => {
      if (currentIds.includes(placeId)) {
        return currentIds.filter((id) => id !== placeId);
      }

      return [placeId, ...currentIds].slice(0, 50);
    });
  };

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
        const address = locale === 'en'
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

        let matchedBy: Suggestion['matchedBy'] = 'name';
        if (nameMatched) {
          matchedBy = 'name';
        } else if (addressMatched) {
          matchedBy = 'address';
        } else if (municipalityMatched) {
          matchedBy = 'municipality';
        } else {
          matchedBy = addressScore > nameScore ? 'address' : 'name';
        }

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

  const showSuggestions = suggestionsOpen && searchQuery.length > 0 && suggestions.length > 0;

  const applySuggestion = (suggestion: Suggestion) => {
    setSearchInput(suggestion.name);
    setDebouncedSearch(suggestion.name);
    setSuggestionsOpen(false);
    inputRef.current?.focus();
  };

  const renderHighlightedSuggestion = (value: string, query: string) => {
    const normalizedQuery = query.trim().toLowerCase();
    const startIndex = value.toLowerCase().indexOf(normalizedQuery);

    if (!normalizedQuery || startIndex < 0) {
      return <Text style={styles.suggestionName}>{value}</Text>;
    }

    const endIndex = startIndex + normalizedQuery.length;

    return (
      <Text style={styles.suggestionName}>
        {value.slice(0, startIndex)}
        <Text style={styles.suggestionNameHighlight}>{value.slice(startIndex, endIndex)}</Text>
        {value.slice(endIndex)}
      </Text>
    );
  };

  const renderHighlightedSecondary = (value: string, query: string) => {
    const normalizedQuery = query.trim().toLowerCase();
    const startIndex = value.toLowerCase().indexOf(normalizedQuery);

    if (!normalizedQuery || startIndex < 0) {
      return <Text style={styles.suggestionSecondary}>{value}</Text>;
    }

    const endIndex = startIndex + normalizedQuery.length;

    return (
      <Text style={styles.suggestionSecondary}>
        {value.slice(0, startIndex)}
        <Text style={styles.suggestionNameHighlight}>{value.slice(startIndex, endIndex)}</Text>
        {value.slice(endIndex)}
      </Text>
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="dark" />
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        onScrollBeginDrag={() => {
          setLanguageMenuOpen(false);
          setSuggestionsOpen(false);
        }}
      >
        <View style={styles.heroCard}>
          <View style={styles.languageMenu}>
            <Pressable
              style={[
                styles.metricsHeaderToggle,
                metricsVisible ? styles.metricsHeaderToggleActive : undefined,
              ]}
              onPress={toggleMetricsVisible}
            >
              <Text
                style={[
                  styles.metricsHeaderToggleText,
                  metricsVisible ? styles.metricsHeaderToggleTextActive : undefined,
                ]}
              >
                {locale === 'et' ? 'Mõõdikud' : 'Metrics'}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.aboutHeaderToggle,
                aboutVisible ? styles.aboutHeaderToggleActive : undefined,
              ]}
              onPress={() => setAboutVisible((value) => !value)}
              accessibilityRole="button"
              accessibilityLabel={locale === 'et' ? 'Ava info andmete kohta' : 'Open data info'}
            >
              <Text
                style={[
                  styles.aboutHeaderToggleText,
                  aboutVisible ? styles.aboutHeaderToggleTextActive : undefined,
                ]}
              >
                ?
              </Text>
            </Pressable>
            <View style={styles.languageControl}>
              <Pressable
                style={styles.languageTrigger}
                onPress={() => setLanguageMenuOpen((value) => !value)}
              >
                <Text style={styles.languageTriggerText}>
                  {locale === 'et' ? 'Keel: Eesti' : 'Language: English'}
                </Text>
              </Pressable>
              {languageMenuOpen ? (
                <View style={styles.languageDropdown}>
                  <Pressable
                    style={styles.languageOption}
                    onPress={() => {
                      setLocale('et');
                      setLanguageMenuOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.languageOptionText,
                        locale === 'et' ? styles.languageOptionTextActive : undefined,
                      ]}
                    >
                      Eesti
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.languageOption}
                    onPress={() => {
                      setLocale('en');
                      setLanguageMenuOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.languageOptionText,
                        locale === 'en' ? styles.languageOptionTextActive : undefined,
                      ]}
                    >
                      English
                    </Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>

          <Text style={styles.heroLabel}>
            {t('appName', locale)}
          </Text>
          <Text style={styles.heroTitle}>
            {locale === 'et'
              ? 'Ujumiskohtade vee kvaliteet Eestis'
              : 'Water quality for swimming places in Estonia'}
          </Text>

          {aboutVisible ? (
            <View style={styles.aboutPanel}>
              <Text style={styles.aboutTitle}>
                {locale === 'et' ? 'Abi: andmeallikas ja uuendused' : 'Help: data source and updates'}
              </Text>
              <Text style={styles.aboutText}>
                {locale === 'et'
                  ? 'VeeValve kasutab Terviseameti avalikke XML-andmeid. Kuvatakse viimased teadaolevad tulemused.'
                  : 'VeeValve uses public XML feeds by the Estonian Health Board. The app shows the latest known sample status.'}
              </Text>
              <Pressable
                onPress={openAboutSourceLink}
                accessibilityRole="link"
                accessibilityLabel={locale === 'et' ? 'Ava andmeallikas' : 'Open data source'}
              >
                <Text style={styles.aboutSourceLink}>{TERVISEAMET_DATA_URL}</Text>
              </Pressable>

              {locale === 'et' ? (
                <>
                  <Text style={styles.aboutListItem}>
                    • Ujulate allikad: ujulad.xml, basseinid.xml, basseini_veeproovid_{'{year}'}.xml
                  </Text>
                  <Text style={styles.aboutListItem}>
                    • Supluskohtade allikad: supluskohad.xml, supluskoha_veeproovid_{'{year}'}.xml
                  </Text>
                  <Text style={styles.aboutListItem}>• Automaatne sünkroon käivitub iga tunni 15. minutil.</Text>
                  <Text style={styles.aboutListItem}>
                    • Muutuseid kontrollitakse ETag/Last-Modified päiste ja sisuräsi abil.
                  </Text>
                  <Text style={styles.aboutListItem}>
                    • Asukohafaile kontrollitakse umbes kord ööpäevas; proovifaile sagedamini (basseinid ~2 h, rannad hooajal ~2 h, väljaspool hooaega ~24 h).
                  </Text>
                  <Text style={styles.aboutTitleSecondary}>Mida tähendavad staatused?</Text>
                  <Text style={styles.aboutListItem}>• Hea: viimane proov vastab nõuetele.</Text>
                  <Text style={styles.aboutListItem}>• Halb: viimane proov ei vasta nõuetele.</Text>
                  <Text style={styles.aboutListItem}>
                    • Teadmata: värske hinnang puudub või staatust ei saanud määrata.
                  </Text>
                  <Text style={styles.aboutTitleSecondary}>Kuidas brauseri tõuketeavitused töötavad?</Text>
                  <Text style={styles.aboutListItem}>
                    • Teavitused on valikulised: esmalt lisa koht lemmikutesse, siis lülita teavitused sisse.
                  </Text>
                  <Text style={styles.aboutListItem}>
                    • Teavitusi saadetakse ainult lemmikutes olevatele kohtadele.
                  </Text>
                  <Text style={styles.aboutListItem}>
                    • Märguanne tuleb staatuse muutuse korral (Hea ↔ Halb), mitte iga uuenduse peale.
                  </Text>
                  <Text style={styles.aboutListItem}>
                    • Teavitused töötavad ka siis, kui leht on suletud (service workeri kaudu).
                  </Text>
                  <Text style={styles.aboutListItem}>
                    • Kui teavitused on blokeeritud, ava need brauseri saidi seadetes uuesti.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.aboutListItem}>
                    • Pool sources: ujulad.xml, basseinid.xml, basseini_veeproovid_{'{year}'}.xml
                  </Text>
                  <Text style={styles.aboutListItem}>
                    • Beach sources: supluskohad.xml, supluskoha_veeproovid_{'{year}'}.xml
                  </Text>
                  <Text style={styles.aboutListItem}>• Automatic sync runs every hour at minute 15.</Text>
                  <Text style={styles.aboutListItem}>
                    • Changes are detected via ETag/Last-Modified headers and content hash checks.
                  </Text>
                  <Text style={styles.aboutListItem}>
                    • Location feeds are checked about once per day; sample feeds more often (pools ~2h, beaches in season ~2h, off-season ~24h).
                  </Text>
                  <Text style={styles.aboutTitleSecondary}>What do statuses mean?</Text>
                  <Text style={styles.aboutListItem}>• Good: the latest sample meets requirements.</Text>
                  <Text style={styles.aboutListItem}>• Bad: the latest sample does not meet requirements.</Text>
                  <Text style={styles.aboutListItem}>
                    • Unknown: no recent rating is available, or a status could not be determined.
                  </Text>
                  <Text style={styles.aboutTitleSecondary}>How do browser push notifications work?</Text>
                  <Text style={styles.aboutListItem}>
                    • Push alerts are opt-in: add a place to favorites first, then enable alerts.
                  </Text>
                  <Text style={styles.aboutListItem}>
                    • Notifications are sent only for favorited places.
                  </Text>
                  <Text style={styles.aboutListItem}>
                    • An alert is sent on status transition (Good ↔ Bad), not on every sync run.
                  </Text>
                  <Text style={styles.aboutListItem}>
                    • Alerts can be delivered even when the page is closed (via service worker).
                  </Text>
                  <Text style={styles.aboutListItem}>
                    • If notifications are blocked, re-enable them in browser site settings.
                  </Text>
                </>
              )}
            </View>
          ) : null}

          {metricsVisible ? (
            <View style={styles.metricsWrap}>
              <View style={[styles.metricCard, styles.metricCardPrimary]}>
                <Text style={[styles.metricLabel, styles.metricLabelDanger]}>
                  {locale === 'et' ? 'Halva kvaliteediga' : 'Bad quality'}
                </Text>
                <View style={styles.metricPrimaryValueRow}>
                  <Text style={[styles.metricValue, styles.metricValueBad, styles.metricValuePrimary]}>
                    {metrics?.badQualityEntries ?? 0}
                  </Text>
                  <Text style={styles.metricShareText}>{badShare}</Text>
                </View>
                <Text style={styles.metricMetaText}>
                  {locale === 'et'
                    ? `Basseinid ${metrics?.badPoolEntries ?? 0} • rannad ${metrics?.badBeachEntries ?? 0}`
                    : `Pools ${metrics?.badPoolEntries ?? 0} • beaches ${metrics?.badBeachEntries ?? 0}`}
                </Text>
              </View>

              <View style={styles.metricsRow}>
                <View style={[styles.metricCard, styles.metricCardCompact]}>
                  <Text style={styles.metricLabel}>
                    {locale === 'et' ? 'Viimane uuendus' : 'Last update'}
                  </Text>
                  <Text style={styles.metricValue}>
                    {formatMetricsDate(metrics?.latestSourceUpdatedAt ?? null, locale)}
                  </Text>
                </View>
                <View style={[styles.metricCard, styles.metricCardCompact]}>
                  <Text style={styles.metricLabel}>
                    {locale === 'et' ? 'Kohti kokku' : 'Total places'}
                  </Text>
                  <Text style={styles.metricValue}>
                    {metrics?.totalEntries ?? 0}
                  </Text>
                </View>
              </View>

              <Pressable
                style={[
                  styles.metricsDetailsToggle,
                  metricsExpanded ? styles.metricsDetailsToggleActive : styles.metricsDetailsToggleInactive,
                ]}
                onPress={toggleMetricsExpanded}
              >
                <Text
                  style={[
                    styles.metricsDetailsToggleText,
                    metricsExpanded
                      ? styles.metricsDetailsToggleTextActive
                      : styles.metricsDetailsToggleTextInactive,
                  ]}
                >
                  {locale === 'et' ? 'Detailid' : 'Details'}
                </Text>
              </Pressable>

              {metricsExpanded ? (
                <View style={styles.metricsExtraGrid}>
                  <View style={styles.metricMiniCard}>
                    <Text style={styles.metricLabel}>
                      {locale === 'et' ? 'Hea kvaliteet' : 'Good quality'}
                    </Text>
                    <Text style={[styles.metricValue, styles.metricValueGood]}>
                      {metrics?.goodQualityEntries ?? 0}
                    </Text>
                  </View>
                  <View style={styles.metricMiniCard}>
                    <Text style={styles.metricLabel}>
                      {locale === 'et' ? 'Teadmata kvaliteet' : 'Unknown quality'}
                    </Text>
                    <Text style={styles.metricValue}>
                      {metrics?.unknownQualityEntries ?? 0}
                    </Text>
                  </View>
                  <View style={styles.metricMiniCard}>
                    <Text style={styles.metricLabel}>
                      {locale === 'et' ? 'Jälgitavad basseinid' : 'Pools monitored'}
                    </Text>
                    <Text style={styles.metricValue}>
                      {metrics?.poolEntries ?? 0}
                    </Text>
                  </View>
                  <View style={styles.metricMiniCard}>
                    <Text style={styles.metricLabel}>
                      {locale === 'et' ? 'Jälgitavad rannad' : 'Beaches monitored'}
                    </Text>
                    <Text style={styles.metricValue}>
                      {metrics?.beachEntries ?? 0}
                    </Text>
                  </View>
                  <View style={styles.metricMiniCard}>
                    <Text style={styles.metricLabel}>
                      {locale === 'et' ? 'Uuendatud viimase 24 h jooksul' : 'Updated in last 24h'}
                    </Text>
                    <Text style={styles.metricValue}>
                      {metrics?.updatedWithin24hEntries ?? 0}
                    </Text>
                  </View>
                  <View style={styles.metricMiniCard}>
                    <Text style={styles.metricLabel}>
                      {locale === 'et' ? 'Viimane proov üle 7 päeva tagasi' : 'Latest sample older than 7 days'}
                    </Text>
                    <Text style={styles.metricValue}>
                      {metrics?.staleOver7dEntries ?? 0}
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.searchSection}>
            <View style={styles.searchInputWrap}>
              <TextInput
                ref={inputRef}
                autoFocus
                value={searchInput}
                onFocus={() => {
                  setLanguageMenuOpen(false);
                  setSuggestionsOpen(true);
                }}
                onChangeText={(value) => {
                  setSearchInput(value);
                  setSuggestionsOpen(true);
                }}
                onSubmitEditing={() => {
                  setSuggestionsOpen(false);
                  inputRef.current?.blur();
                  Keyboard.dismiss();
                }}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
                placeholder={
                  locale === 'et'
                    ? 'Sisesta koha nimi või omavalitsus...'
                    : 'Type place name or municipality...'
                }
                placeholderTextColor="#6B7280"
                style={styles.searchInput}
              />

              {searchInput ? (
                <Pressable
                  style={styles.clearSearchButton}
                  onPress={() => {
                    setSearchInput('');
                    setDebouncedSearch('');
                    setSuggestionsOpen(false);
                    inputRef.current?.focus();
                  }}
                >
                  <Text style={styles.clearSearchButtonText}>
                    {locale === 'et' ? 'Puhasta' : 'Clear'}
                  </Text>
                </Pressable>
              ) : null}
            </View>

            {showSuggestions ? (
              <View style={styles.suggestionsList}>
                {suggestions.map((suggestion) => (
                  <Pressable
                    key={`${suggestion.id}-${suggestion.name}`}
                    style={styles.suggestionButton}
                    onPress={() => applySuggestion(suggestion)}
                  >
                    {renderHighlightedSuggestion(suggestion.name, searchQuery)}
                    {suggestion.matchedBy === 'address' && suggestion.address
                      ? renderHighlightedSecondary(suggestion.address, searchQuery)
                      : renderHighlightedSecondary(suggestion.municipality, searchQuery)}
                    {suggestion.matchedBy !== 'name' ? (
                      <Text style={styles.suggestionReason}>
                        {suggestion.matchedBy === 'address'
                          ? (locale === 'et' ? 'Aadressi vaste' : 'Address match')
                          : (locale === 'et' ? 'Omavalitsuse vaste' : 'Municipality match')}
                      </Text>
                    ) : null}
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Text style={styles.searchHint}>
              {locale === 'et'
                ? 'Otsingusoovitused uuenevad kirjutamise ajal.'
                : 'Autocomplete suggestions update as you type.'}
            </Text>
          </View>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterTitle}>
            {locale === 'et' ? 'Filtreeri' : 'Filter'}
          </Text>
          <View style={styles.filterWrap}>
            <Pressable
              style={[
                styles.filterButton,
                typeFilter === 'ALL' && statusFilter === 'ALL'
                  ? styles.filterButtonActive
                  : styles.filterButtonInactive,
              ]}
              onPress={() => {
                setTypeFilter('ALL');
                setStatusFilter('ALL');
              }}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  typeFilter === 'ALL' && statusFilter === 'ALL'
                    ? styles.filterButtonTextActive
                    : styles.filterButtonTextInactive,
                ]}
              >
                {locale === 'et' ? 'Kõik kohad' : 'All places'}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.filterButton,
                typeFilter === 'BEACH' ? styles.filterButtonActive : styles.filterButtonInactive,
              ]}
              onPress={() => setTypeFilter((value) => (value === 'BEACH' ? 'ALL' : 'BEACH'))}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  typeFilter === 'BEACH'
                    ? styles.filterButtonTextActive
                    : styles.filterButtonTextInactive,
                ]}
              >
                {t('beaches', locale)}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.filterButton,
                typeFilter === 'POOL' ? styles.filterButtonActive : styles.filterButtonInactive,
              ]}
              onPress={() => setTypeFilter((value) => (value === 'POOL' ? 'ALL' : 'POOL'))}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  typeFilter === 'POOL'
                    ? styles.filterButtonTextActive
                    : styles.filterButtonTextInactive,
                ]}
              >
                {t('pools', locale)}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.filterButton,
                statusFilter === 'GOOD' ? styles.filterButtonActive : styles.filterButtonInactive,
              ]}
              onPress={() => setStatusFilter((value) => (value === 'GOOD' ? 'ALL' : 'GOOD'))}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  statusFilter === 'GOOD'
                    ? styles.filterButtonTextActive
                    : styles.filterButtonTextInactive,
                ]}
              >
                {t('qualityGood', locale)}
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.filterButton,
                statusFilter === 'BAD' ? styles.filterButtonActive : styles.filterButtonInactive,
              ]}
              onPress={() => setStatusFilter((value) => (value === 'BAD' ? 'ALL' : 'BAD'))}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  statusFilter === 'BAD'
                    ? styles.filterButtonTextActive
                    : styles.filterButtonTextInactive,
                ]}
              >
                {t('qualityBad', locale)}
              </Text>
            </Pressable>
          </View>
        </View>

        {hasFavorites ? (
          <View style={styles.favoritesSection}>
            <View style={styles.favoritesHeaderRow}>
              <Text style={styles.favoritesTitle}>{t('favorites', locale)}</Text>
              <Text style={styles.favoritesCountBadge}>{favoritePlaces.length}</Text>
            </View>

            {favoritesLoading && favoritePlaces.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  {locale === 'et' ? 'Laadin lemmikuid...' : 'Loading favorites...'}
                </Text>
              </View>
            ) : favoritePlaces.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>
                  {locale === 'et'
                    ? 'Lemmikuid ei õnnestunud hetkel laadida.'
                    : 'Could not load favorites right now.'}
                </Text>
              </View>
            ) : (
              favoritePlaces.map((place) => (
                <NativePlaceCard
                  key={`favorite-${place.id}`}
                  place={place}
                  locale={locale}
                  referenceTimeIso={referenceTimeIso}
                  isFavorite
                  onToggleFavorite={toggleFavorite}
                />
              ))
            )}
          </View>
        ) : null}

        <View style={styles.notificationsCard}>
          <Text style={styles.notificationsTitle}>
            {locale === 'et' ? 'Teavitused' : 'Notifications'}
          </Text>
          <ToggleRow
            label={
              locale === 'et'
                ? 'Saada teavitus kvaliteedi muutumisel'
                : 'Notify when water quality changes'
            }
            value={qualityAlertsEnabled}
            onToggle={() => setQualityAlertsEnabled((value) => !value)}
          />
          <ToggleRow
            label={
              locale === 'et'
                ? 'Asukohapõhine teavitus läheduses'
                : 'Location alerts when nearby'
            }
            value={locationAlertsEnabled}
            onToggle={() => setLocationAlertsEnabled((value) => !value)}
          />
        </View>

        <View style={styles.resultsMetaRow}>
          <Text style={styles.resultsMetaText}>
            {searchQuery
              ? locale === 'et'
                ? `Otsing: "${searchQuery}". Näitan ${shownResultsCount} tulemust (maksimaalselt ${visibleResultsLimit}).`
                : `Search: "${searchQuery}". Showing ${shownResultsCount} of up to ${visibleResultsLimit} results.`
              : locale === 'et'
                ? `Kuvan ${shownResultsCount} viimati uuendatud kohta.`
                : `Showing ${shownResultsCount} most recently updated places.`}
          </Text>
          {loading ? <ActivityIndicator size="small" color="#0A8F78" /> : null}
        </View>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {places.length === 0 && !loading ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {locale === 'et'
                ? 'Sobivaid kohti ei leitud valitud filtritega.'
                : 'No places found with the selected filters.'}
            </Text>
          </View>
        ) : (
          places.map((place) => (
            <NativePlaceCard
              key={place.id}
              place={place}
              locale={locale}
              referenceTimeIso={referenceTimeIso}
              isFavorite={favoriteIdSet.has(place.id)}
              onToggleFavorite={toggleFavorite}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default App;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F2F7F5',
  },
  scroll: {
    padding: 18,
    paddingBottom: 40,
  },
  heroCard: {
    position: 'relative',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 18,
    shadowColor: '#06685A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.18,
    shadowRadius: 28,
    marginBottom: 18,
  },
  heroLabel: {
    color: '#0A8F78',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  heroTitle: {
    marginTop: 8,
    color: '#153233',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
  },
  heroSubtitle: {
    marginTop: 10,
    color: '#4B5563',
    fontSize: 14,
  },
  metricsWrap: {
    marginTop: 12,
    gap: 8,
  },
  metricCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E9E5',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metricCardPrimary: {
    borderColor: '#FED7D7',
    backgroundColor: '#FFF1F2',
  },
  metricCardCompact: {
    flex: 1,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metricLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#64748B',
  },
  metricLabelDanger: {
    color: '#B42318',
  },
  metricValue: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '700',
    color: '#153233',
  },
  metricValuePrimary: {
    marginTop: 0,
    fontSize: 24,
    lineHeight: 28,
  },
  metricValueBad: {
    color: '#B42318',
  },
  metricValueGood: {
    color: '#047857',
  },
  metricPrimaryValueRow: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  metricShareText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B42318',
    marginBottom: 3,
  },
  metricMetaText: {
    marginTop: 4,
    fontSize: 12,
    color: '#9F1239',
  },
  metricsHeaderToggle: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CDE6DF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metricsHeaderToggleActive: {
    backgroundColor: '#0A8F78',
    borderColor: '#0A8F78',
  },
  metricsHeaderToggleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A8F78',
  },
  metricsHeaderToggleTextActive: {
    color: '#FFFFFF',
  },
  aboutHeaderToggle: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CDE6DF',
    backgroundColor: '#FFFFFF',
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aboutHeaderToggleActive: {
    backgroundColor: '#0A8F78',
    borderColor: '#0A8F78',
  },
  aboutHeaderToggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0A8F78',
  },
  aboutHeaderToggleTextActive: {
    color: '#FFFFFF',
  },
  aboutPanel: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E9E5',
    backgroundColor: '#F8FCFA',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  aboutTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#153233',
  },
  aboutTitleSecondary: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '700',
    color: '#153233',
  },
  aboutText: {
    fontSize: 12,
    color: '#475569',
  },
  aboutSourceLink: {
    fontSize: 12,
    color: '#0A8F78',
    textDecorationLine: 'underline',
    textDecorationStyle: 'dotted',
  },
  aboutListItem: {
    fontSize: 11,
    lineHeight: 15,
    color: '#475569',
  },
  metricsDetailsToggle: {
    marginTop: 4,
    alignSelf: 'flex-end',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metricsDetailsToggleActive: {
    borderColor: '#0A8F78',
    backgroundColor: '#0A8F78',
  },
  metricsDetailsToggleInactive: {
    borderColor: '#CDE6DF',
    backgroundColor: '#FFFFFF',
  },
  metricsDetailsToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricsDetailsToggleTextActive: {
    color: '#FFFFFF',
  },
  metricsDetailsToggleTextInactive: {
    color: '#0A8F78',
  },
  metricsExtraGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metricMiniCard: {
    width: '48%',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E9E5',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchSection: {
    marginTop: 14,
  },
  searchLabel: {
    marginBottom: 7,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.4,
    color: '#0A8F78',
  },
  searchInputWrap: {
    position: 'relative',
  },
  searchInput: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#CDE6DF',
    backgroundColor: '#FFFFFF',
    paddingLeft: 14,
    paddingRight: 78,
    fontSize: 16,
    color: '#153233',
  },
  clearSearchButton: {
    position: 'absolute',
    right: 10,
    top: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CDE6DF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  clearSearchButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  suggestionsList: {
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#CDE6DF',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  suggestionButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E2E8F0',
  },
  suggestionName: {
    fontSize: 14,
    color: '#153233',
  },
  suggestionNameHighlight: {
    fontWeight: '700',
    color: '#0A8F78',
  },
  suggestionSecondary: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748B',
  },
  suggestionReason: {
    marginTop: 4,
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 0.5,
    color: '#94A3B8',
    textTransform: 'uppercase',
  },
  searchHint: {
    marginTop: 6,
    fontSize: 12,
    color: '#6B7280',
  },
  languageMenu: {
    position: 'absolute',
    right: 14,
    top: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    zIndex: 20,
  },
  languageControl: {
    alignItems: 'flex-end',
  },
  languageTrigger: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CDE6DF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  languageTriggerText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0A8F78',
  },
  languageDropdown: {
    marginTop: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#CDE6DF',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    minWidth: 126,
  },
  languageOption: {
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  languageOptionText: {
    fontSize: 13,
    color: '#153233',
  },
  languageOptionTextActive: {
    fontWeight: '700',
    color: '#0A8F78',
  },
  filterSection: {
    marginBottom: 14,
  },
  filterTitle: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: '700',
    color: '#0A8F78',
  },
  filterWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  filterButtonActive: {
    borderColor: '#0A8F78',
    backgroundColor: '#0A8F78',
  },
  filterButtonInactive: {
    borderColor: '#CDE6DF',
    backgroundColor: '#FFFFFF',
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: '600',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  filterButtonTextInactive: {
    color: '#153233',
  },
  favoritesSection: {
    marginBottom: 16,
  },
  favoritesHeaderRow: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  favoritesTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#0A8F78',
  },
  favoritesCountBadge: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#CDE6DF',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 12,
    fontWeight: '600',
    color: '#475569',
  },
  notificationsCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#D9E9E5',
    backgroundColor: '#FFFFFF',
    padding: 14,
    marginBottom: 16,
  },
  notificationsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#153233',
    marginBottom: 10,
  },
  resultsMetaRow: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  resultsMetaText: {
    flex: 1,
    fontSize: 12,
    color: '#64748B',
  },
  errorCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F5C2C7',
    backgroundColor: '#FFF1F2',
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 13,
    color: '#9F1239',
  },
  emptyCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D9E9E5',
    backgroundColor: '#FFFFFF',
    padding: 12,
  },
  emptyText: {
    fontSize: 13,
    color: '#4B5563',
  },
});
