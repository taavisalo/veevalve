import {
  fuzzySuggestionThreshold,
  normalizeFuzzyText,
  scoreFuzzyMatch,
  t,
  type AppLocale,
  type PlaceType,
  type PlaceWithLatestReading,
  type QualityStatus,
} from '@veevalve/core';
import { NativePlaceCard } from '@veevalve/ui/native';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ToggleRow } from './src/components/toggle-row';
import { fetchPlaces } from './src/lib/fetch-places';

const RESULTS_LIMIT = 10;
const SUGGESTION_LIMIT = 8;
const SEARCH_DEBOUNCE_MS = 180;

interface Suggestion {
  id: string;
  name: string;
  municipality: string;
}

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

  const inputRef = useRef<TextInput | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    const controller = new AbortController();

    setLoading(true);
    setError(null);

    fetchPlaces({
      locale,
      type: typeFilter === 'ALL' ? undefined : typeFilter,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
      search: debouncedSearch || undefined,
      limit: RESULTS_LIMIT,
      signal: controller.signal,
    })
      .then((nextPlaces) => {
        setPlaces(nextPlaces.slice(0, RESULTS_LIMIT));
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

  const searchQuery = searchInput.trim();

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
      .map((place) => ({
        place,
        score: scoreFuzzyMatch({
          query: normalizedSearch,
          primary: locale === 'en' ? place.nameEn : place.nameEt,
          secondary: place.municipality,
        }),
      }))
      .filter(({ score }) => score >= threshold)
      .sort((left, right) => right.score - left.score);

    const seen = new Set<string>();
    const nextSuggestions: Suggestion[] = [];

    for (const { place } of rankedPlaces) {
      const name = locale === 'en' ? place.nameEn : place.nameEt;
      const key = `${name}|${place.municipality}`;
      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      nextSuggestions.push({
        id: place.id,
        name,
        municipality: place.municipality,
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

          <Text style={styles.heroLabel}>
            {t('appName', locale)}
          </Text>
          <Text style={styles.heroTitle}>
            {locale === 'et'
              ? 'Ujumiskohtade vee kvaliteet Eestis'
              : 'Water quality for swimming places in Estonia'}
          </Text>
          <Text style={styles.heroSubtitle}>{t('subtitle', locale)}</Text>

          <View style={styles.searchSection}>
            <Text style={styles.searchLabel}>
              {locale === 'et' ? 'Otsi ujumiskohta' : 'Search swimming places'}
            </Text>
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
                    <Text style={styles.suggestionMunicipality}>{suggestion.municipality}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <Text style={styles.searchHint}>
              {locale === 'et'
                ? 'Automaatne soovitus otsingule uuendab tulemusi kirjutamise ajal.'
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
                ? `Otsing: "${searchQuery}". Näitan kuni ${RESULTS_LIMIT} tulemust.`
                : `Search: "${searchQuery}". Showing up to ${RESULTS_LIMIT} results.`
              : locale === 'et'
                ? `Näitan ${RESULTS_LIMIT} värskeimat kohta.`
                : `Showing ${RESULTS_LIMIT} most recently updated places.`}
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
          places.map((place) => <NativePlaceCard key={place.id} place={place} />)
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
  suggestionMunicipality: {
    marginTop: 2,
    fontSize: 12,
    color: '#64748B',
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
    alignItems: 'flex-end',
    zIndex: 20,
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
