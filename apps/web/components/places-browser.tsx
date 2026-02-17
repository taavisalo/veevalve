'use client';

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
import { PlaceCard } from '@veevalve/ui/web';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { fetchPlacesByIds, type PlaceMetrics } from '../lib/fetch-places';
import { readFavoritePlaceIds, writeFavoritePlaceIds } from '../lib/favorites-storage';
import { mapPlaceApiRows, type PlaceApiRow } from '../lib/place-api';
import { readMetricsUiPreferences, writeMetricsUiPreferences } from '../lib/ui-preferences-storage';

const LATEST_RESULTS_LIMIT = 10;
const SEARCH_RESULTS_LIMIT = 20;
const SUGGESTION_LIMIT = 8;
const SEARCH_DEBOUNCE_MS = 180;
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
const TERVISEAMET_DATA_URL = 'https://vtiav.sm.ee/index.php/?active_tab_id=A';

const getResultsLimit = (search?: string): number =>
  search?.trim() ? SEARCH_RESULTS_LIMIT : LATEST_RESULTS_LIMIT;

interface PlacesBrowserProps {
  initialLocale: AppLocale;
  initialType: PlaceType | 'ALL';
  initialStatus: QualityStatus | 'ALL';
  initialSearch?: string;
  initialPlaces: PlaceWithLatestReading[];
  initialNowIso: string;
  initialMetrics: PlaceMetrics;
}

interface Suggestion {
  id: string;
  name: string;
  municipality: string;
  address?: string;
  matchedBy: 'name' | 'municipality' | 'address';
}

interface FilterButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

const FilterButton = ({ label, active, onClick }: FilterButtonProps) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium transition ${
        active
          ? 'border-accent bg-accent text-white'
          : 'border-emerald-100 bg-white text-ink hover:border-accent hover:text-accent'
      }`}
    >
      {label}
    </button>
  );
};

const fetchPlacesFromApi = async ({
  locale,
  type,
  status,
  search,
  signal,
}: {
  locale: AppLocale;
  type: PlaceType | 'ALL';
  status: QualityStatus | 'ALL';
  search?: string;
  signal: AbortSignal;
}): Promise<PlaceWithLatestReading[]> => {
  const params = new URLSearchParams();
  params.set('locale', locale);
  params.set('limit', String(getResultsLimit(search)));
  params.set('sort', 'LATEST');

  if (type !== 'ALL') {
    params.set('type', type);
  }

  if (status !== 'ALL') {
    params.set('status', status);
  }

  if (search) {
    params.set('search', search);
  }

  const response = await fetch(`${API_BASE_URL}/places?${params.toString()}`, {
    cache: 'no-store',
    signal,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch places: ${response.status}`);
  }

  const rows = (await response.json()) as PlaceApiRow[];
  return mapPlaceApiRows(rows);
};

const highlightMatch = (value: string, search: string) => {
  const query = search.trim();
  if (!query) {
    return value;
  }

  const lowerValue = value.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const startIndex = lowerValue.indexOf(lowerQuery);

  if (startIndex === -1) {
    return value;
  }

  const endIndex = startIndex + query.length;

  return (
    <>
      {value.slice(0, startIndex)}
      <span className="font-semibold text-accent">{value.slice(startIndex, endIndex)}</span>
      {value.slice(endIndex)}
    </>
  );
};

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

export const PlacesBrowser = ({
  initialLocale,
  initialType,
  initialStatus,
  initialSearch,
  initialPlaces,
  initialNowIso,
  initialMetrics,
}: PlacesBrowserProps) => {
  const [locale, setLocale] = useState<AppLocale>(initialLocale);
  const [typeFilter, setTypeFilter] = useState<PlaceType | 'ALL'>(initialType);
  const [statusFilter, setStatusFilter] = useState<QualityStatus | 'ALL'>(initialStatus);
  const [searchInput, setSearchInput] = useState(initialSearch ?? '');
  const [debouncedSearch, setDebouncedSearch] = useState((initialSearch ?? '').trim());
  const [places, setPlaces] = useState<PlaceWithLatestReading[]>(
    initialPlaces.slice(0, getResultsLimit(initialSearch)),
  );
  const [loading, setLoading] = useState(false);
  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [referenceTimeIso, setReferenceTimeIso] = useState(initialNowIso);
  const [metrics, setMetrics] = useState<PlaceMetrics>(initialMetrics);
  const [metricsExpanded, setMetricsExpanded] = useState(false);
  const [metricsVisible, setMetricsVisible] = useState(false);
  const [aboutVisible, setAboutVisible] = useState(false);
  const [metricsPreferencesHydrated, setMetricsPreferencesHydrated] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [favoritesHydrated, setFavoritesHydrated] = useState(false);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritePlaces, setFavoritePlaces] = useState<PlaceWithLatestReading[]>([]);

  const isInitialRender = useRef(true);
  const searchContainerRef = useRef<HTMLDivElement | null>(null);
  const languageContainerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const suggestionsListId = useId();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchPlacesFromApi({
      locale,
      type: typeFilter,
      status: statusFilter,
      search: debouncedSearch || undefined,
      signal: controller.signal,
    })
      .then((nextPlaces) => {
        setPlaces(nextPlaces.slice(0, getResultsLimit(debouncedSearch)));
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

    return () => controller.abort();
  }, [debouncedSearch, locale, statusFilter, typeFilter]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setReferenceTimeIso(new Date().toISOString());
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    setMetrics(initialMetrics);
  }, [initialMetrics]);

  useEffect(() => {
    const preferences = readMetricsUiPreferences();
    setMetricsVisible(preferences.metricsVisible);
    setMetricsExpanded(preferences.metricsExpanded);
    setMetricsPreferencesHydrated(true);
  }, []);

  useEffect(() => {
    if (!metricsPreferencesHydrated) {
      return;
    }

    writeMetricsUiPreferences({
      metricsVisible,
      metricsExpanded,
    });
  }, [metricsExpanded, metricsPreferencesHydrated, metricsVisible]);

  useEffect(() => {
    setFavoriteIds(readFavoritePlaceIds());
    setFavoritesHydrated(true);
  }, []);

  useEffect(() => {
    if (!favoritesHydrated) {
      return;
    }

    writeFavoritePlaceIds(favoriteIds);
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

    return () => controller.abort();
  }, [favoriteIds, locale]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setSuggestionsOpen(false);
        setActiveSuggestionIndex(-1);
      }
      if (languageContainerRef.current && !languageContainerRef.current.contains(target)) {
        setLanguageMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  useEffect(() => {
    const onSlashShortcut = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const tagName = target?.tagName.toLowerCase();
      const isTypingElement =
        tagName === 'input' || tagName === 'textarea' || target?.isContentEditable;

      if (isTypingElement) {
        return;
      }

      event.preventDefault();
      inputRef.current?.focus();
      setSuggestionsOpen(true);
    };

    window.addEventListener('keydown', onSlashShortcut);
    return () => window.removeEventListener('keydown', onSlashShortcut);
  }, []);

  const searchQuery = searchInput.trim();
  const visibleResultsLimit = getResultsLimit(searchQuery);
  const visiblePlaces = places.slice(0, visibleResultsLimit);
  const shownResultsCount = visiblePlaces.length;
  const badShare = formatShare(metrics.badQualityEntries, metrics.totalEntries);
  const favoriteIdSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const hasFavorites = favoriteIds.length > 0;

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

  useEffect(() => {
    if (activeSuggestionIndex >= suggestions.length) {
      setActiveSuggestionIndex(-1);
    }
  }, [activeSuggestionIndex, suggestions.length]);

  const showSuggestions = suggestionsOpen && searchQuery.length > 0 && suggestions.length > 0;

  const applySuggestion = (suggestion: Suggestion) => {
    setSearchInput(suggestion.name);
    setDebouncedSearch(suggestion.name);
    setSuggestionsOpen(false);
    setActiveSuggestionIndex(-1);
    inputRef.current?.focus();
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 md:px-8 md:pt-14">
      <section className="fade-up relative overflow-hidden rounded-3xl border border-emerald-200/70 bg-white/75 p-8 shadow-card backdrop-blur">
        <div className="absolute right-6 top-4 z-10 flex items-start gap-2" ref={languageContainerRef}>
          <button
            type="button"
            aria-pressed={aboutVisible}
            onClick={() => setAboutVisible((value) => !value)}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-full border text-sm font-semibold leading-none transition ${
              aboutVisible
                ? 'border-accent bg-accent text-white'
                : 'border-emerald-100 bg-white text-accent hover:border-accent'
            }`}
            aria-label={locale === 'et' ? 'Ava info andmete kohta' : 'Open data info'}
            title={locale === 'et' ? 'Info' : 'About'}
          >
            ?
          </button>
          <button
            type="button"
            aria-pressed={metricsVisible}
            onClick={() => setMetricsVisible((value) => !value)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              metricsVisible
                ? 'border-accent bg-accent text-white'
                : 'border-emerald-100 bg-white text-accent hover:border-accent'
            }`}
          >
            {locale === 'et' ? 'Mõõdikud' : 'Metrics'}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setLanguageMenuOpen((value) => !value)}
              className="rounded-full border border-emerald-100 bg-white px-3 py-1 text-xs font-semibold text-accent transition hover:border-accent"
            >
              {locale === 'et' ? 'Keel: Eesti' : 'Language: English'}
            </button>
            {languageMenuOpen ? (
              <div className="absolute right-0 z-10 mt-2 w-40 overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-card">
                <button
                  type="button"
                  onClick={() => {
                    setLocale('et');
                    setLanguageMenuOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm transition ${
                    locale === 'et'
                      ? 'bg-emerald-50 font-semibold text-accent'
                      : 'text-ink hover:bg-emerald-50'
                  }`}
                >
                  Eesti
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLocale('en');
                    setLanguageMenuOpen(false);
                  }}
                  className={`block w-full px-3 py-2 text-left text-sm transition ${
                    locale === 'en'
                      ? 'bg-emerald-50 font-semibold text-accent'
                      : 'text-ink hover:bg-emerald-50'
                  }`}
                >
                  English
                </button>
              </div>
            ) : null}
          </div>
        </div>
        <p className="text-sm uppercase tracking-[0.14em] text-accent">{t('appName', locale)}</p>
        <h1 className="mt-3 max-w-3xl text-4xl leading-tight text-ink md:text-5xl">
          {locale === 'et'
            ? 'Vee kvaliteet randades ja basseinides'
            : 'Water quality for beaches and pools'}
        </h1>

        {aboutVisible ? (
          <div className="mt-4 rounded-2xl border border-emerald-100 bg-white/85 p-4 text-sm text-slate-700">
            <p className="font-semibold text-ink">
              {locale === 'et' ? 'Kust andmed tulevad?' : 'Where does this data come from?'}
            </p>
            <p className="mt-1">
              {locale === 'et'
                ? (
                    <>
                      Andmed pärinevad Terviseameti avalikest XML-andmetest (
                      <a
                        href={TERVISEAMET_DATA_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent underline decoration-dotted underline-offset-2"
                      >
                        vtiav.sm.ee
                      </a>
                      ).
                    </>
                  )
                : (
                    <>
                      Data comes from public XML feeds by the Estonian Health Board (
                      <a
                        href={TERVISEAMET_DATA_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent underline decoration-dotted underline-offset-2"
                      >
                        vtiav.sm.ee
                      </a>
                      ).
                    </>
                  )}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
              {locale === 'et' ? (
                <>
                  <li>Ujulate ja basseinide allikad: `ujulad.xml`, `basseinid.xml`, `basseini_veeproovid_{'{year}'}.xml`.</li>
                  <li>Supluskohtade allikad: `supluskohad.xml`, `supluskoha_veeproovid_{'{year}'}.xml`.</li>
                  <li>Andmete uuendamine käivitub iga tunni 15. minutil.</li>
                  <li>Muutuseid kontrollitakse `ETag`/`Last-Modified` päistega ja sisuräsi abil.</li>
                  <li>Asukohafaile kontrollitakse umbes kord ööpäevas; proovifaile sagedamini (basseinid ~2 h, rannad hooajal ~2 h, väljaspool hooaega ~24 h).</li>
                </>
              ) : (
                <>
                  <li>Pool sources: `ujulad.xml`, `basseinid.xml`, `basseini_veeproovid_{'{year}'}.xml`.</li>
                  <li>Beach sources: `supluskohad.xml`, `supluskoha_veeproovid_{'{year}'}.xml`.</li>
                  <li>Automatic sync runs every hour at minute 15.</li>
                  <li>Changes are detected via `ETag`/`Last-Modified` headers and content hash checks.</li>
                  <li>Location feeds are checked about once per day; sample feeds more often (pools ~2h, beaches in season ~2h, off-season ~24h).</li>
                </>
              )}
            </ul>

            <p className="mt-3 font-semibold text-ink">
              {locale === 'et' ? 'Mida tähendavad staatused?' : 'What do statuses mean?'}
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-slate-600">
              {locale === 'et' ? (
                <>
                  <li>`Hea`: viimane proov vastab nõuetele.</li>
                  <li>`Halb`: viimane proov ei vasta nõuetele.</li>
                  <li>`Teadmata`: värske hinnang puudub või staatust ei saanud määrata.</li>
                </>
              ) : (
                <>
                  <li>`Good`: the latest sample meets requirements.</li>
                  <li>`Bad`: the latest sample does not meet requirements.</li>
                  <li>`Unknown`: no recent rating is available, or a status could not be determined.</li>
                </>
              )}
            </ul>
          </div>
        ) : null}

        {metricsVisible ? (
          <div id="metrics-panel" className="mt-4">
            <div className="grid gap-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
              <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.08em] text-rose-700">
                  {locale === 'et' ? 'Halva kvaliteediga' : 'Bad quality'}
                </p>
                <div className="mt-1 flex items-end gap-2">
                  <p className="text-2xl font-semibold leading-none text-rose-700">
                    {metrics.badQualityEntries}
                  </p>
                  <p className="text-xs font-semibold text-rose-600">{badShare}</p>
                </div>
                <p className="mt-1 text-xs text-rose-700/90">
                  {locale === 'et'
                    ? `Basseinid ${metrics.badPoolEntries} • rannad ${metrics.badBeachEntries}`
                    : `Pools ${metrics.badPoolEntries} • beaches ${metrics.badBeachEntries}`}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-white/80 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">
                  {locale === 'et' ? 'Viimane uuendus' : 'Last update'}
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">
                  {formatMetricsDate(metrics.latestSourceUpdatedAt, locale)}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-100 bg-white/80 px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">
                  {locale === 'et' ? 'Kohti kokku' : 'Total places'}
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">{metrics.totalEntries}</p>
              </div>
            </div>

            <div className="mt-1 flex justify-end">
              <button
                type="button"
                aria-pressed={metricsExpanded}
                onClick={() => setMetricsExpanded((value) => !value)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                  metricsExpanded
                    ? 'border-accent bg-accent text-white'
                    : 'border-emerald-100 bg-white text-accent hover:border-accent'
                }`}
              >
                {locale === 'et' ? 'Detailid' : 'Details'}
              </button>
            </div>

            {metricsExpanded ? (
              <div id="extra-metrics" className="mt-2 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                <div className="rounded-xl border border-emerald-100 bg-white/80 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">
                    {locale === 'et' ? 'Hea kvaliteet' : 'Good quality'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-emerald-700">{metrics.goodQualityEntries}</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-white/80 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">
                    {locale === 'et' ? 'Teadmata kvaliteet' : 'Unknown quality'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-700">{metrics.unknownQualityEntries}</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-white/80 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">
                    {locale === 'et' ? 'Jälgitavad basseinid' : 'Pools monitored'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">{metrics.poolEntries}</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-white/80 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">
                    {locale === 'et' ? 'Jälgitavad rannad' : 'Beaches monitored'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">{metrics.beachEntries}</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-white/80 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">
                    {locale === 'et' ? 'Uuendatud viimase 24 h jooksul' : 'Updated in last 24h'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">{metrics.updatedWithin24hEntries}</p>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-white/80 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500">
                    {locale === 'et' ? 'Viimane proov üle 7 päeva tagasi' : 'Latest sample older than 7 days'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-ink">{metrics.staleOver7dEntries}</p>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="mt-5 max-w-3xl" ref={searchContainerRef}>
          <label htmlFor="place-search" className="sr-only">
            {locale === 'et' ? 'Otsi ujumiskohta' : 'Search swimming places'}
          </label>
          <div className="relative">
            <svg
              aria-hidden="true"
              viewBox="0 0 20 20"
              className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            >
              <path
                d="M13.442 12.032l4.263 4.263-1.41 1.41-4.264-4.263a7 7 0 1 1 1.41-1.41zM8.5 13A4.5 4.5 0 1 0 8.5 4a4.5 4.5 0 0 0 0 9z"
                fill="currentColor"
              />
            </svg>
            <input
              id="place-search"
              ref={inputRef}
              type="text"
              autoFocus
              value={searchInput}
              onFocus={() => setSuggestionsOpen(true)}
              onChange={(event) => {
                setSearchInput(event.target.value);
                setSuggestionsOpen(true);
                setActiveSuggestionIndex(-1);
              }}
              onKeyDown={(event) => {
                if (event.key === 'ArrowDown' && suggestions.length > 0) {
                  event.preventDefault();
                  setSuggestionsOpen(true);
                  setActiveSuggestionIndex((value) =>
                    value >= suggestions.length - 1 ? 0 : value + 1,
                  );
                  return;
                }

                if (event.key === 'ArrowUp' && suggestions.length > 0) {
                  event.preventDefault();
                  setSuggestionsOpen(true);
                  setActiveSuggestionIndex((value) =>
                    value <= 0 ? suggestions.length - 1 : value - 1,
                  );
                  return;
                }

                if (event.key === 'Enter' && activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length) {
                  event.preventDefault();
                  const selectedSuggestion = suggestions[activeSuggestionIndex];
                  if (selectedSuggestion) {
                    applySuggestion(selectedSuggestion);
                  }
                  return;
                }

                if (event.key === 'Enter') {
                  event.preventDefault();
                  setSuggestionsOpen(false);
                  setActiveSuggestionIndex(-1);
                  return;
                }

                if (event.key === 'Escape') {
                  setSuggestionsOpen(false);
                  setActiveSuggestionIndex(-1);
                }
              }}
              placeholder={
                locale === 'et'
                  ? 'Sisesta koha nimi või omavalitsus...'
                  : 'Type place name or municipality...'
              }
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showSuggestions}
              aria-controls={showSuggestions ? suggestionsListId : undefined}
              aria-activedescendant={
                showSuggestions && activeSuggestionIndex >= 0
                  ? `${suggestionsListId}-${activeSuggestionIndex}`
                  : undefined
              }
              className="h-14 w-full rounded-2xl border border-emerald-200 bg-white pl-12 pr-28 text-base text-ink shadow-card outline-none transition placeholder:text-slate-400 focus:border-accent focus:ring-2 focus:ring-emerald-200"
            />
            {searchInput ? (
              <button
                type="button"
                onClick={() => {
                  setSearchInput('');
                  setDebouncedSearch('');
                  setSuggestionsOpen(false);
                  setActiveSuggestionIndex(-1);
                  inputRef.current?.focus();
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-emerald-100 px-2 py-1 text-xs font-medium text-slate-600 transition hover:border-accent hover:text-accent"
              >
                {locale === 'et' ? 'Puhasta' : 'Clear'}
              </button>
            ) : (
              <kbd className="absolute right-4 top-1/2 -translate-y-1/2 rounded border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[11px] text-slate-500">
                /
              </kbd>
            )}
          </div>

          {showSuggestions ? (
            <ul
              id={suggestionsListId}
              role="listbox"
              className="mt-2 overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-card"
            >
              {suggestions.map((suggestion, index) => (
                <li
                  key={`${suggestion.id}-${suggestion.name}`}
                  id={`${suggestionsListId}-${index}`}
                  role="option"
                  aria-selected={index === activeSuggestionIndex}
                >
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applySuggestion(suggestion)}
                    className={`block w-full px-4 py-3 text-left transition ${
                      index === activeSuggestionIndex ? 'bg-emerald-50' : 'hover:bg-emerald-50'
                    }`}
                  >
                    <p className="text-sm text-ink">
                      {highlightMatch(suggestion.name, searchQuery)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {suggestion.matchedBy === 'address' && suggestion.address
                        ? highlightMatch(suggestion.address, searchQuery)
                        : highlightMatch(suggestion.municipality, searchQuery)}
                    </p>
                    {suggestion.matchedBy !== 'name' ? (
                      <p className="mt-1 text-[11px] uppercase tracking-[0.08em] text-slate-400">
                        {suggestion.matchedBy === 'address'
                          ? (locale === 'et' ? 'Aadressi vaste' : 'Address match')
                          : (locale === 'et' ? 'Omavalitsuse vaste' : 'Municipality match')}
                      </p>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          <p className="mt-2 text-xs text-slate-500">
            {locale === 'et'
              ? 'Otsingusoovitused uuenevad kirjutamise ajal. Vajuta "/", et otsingusse liikuda.'
              : 'Autocomplete suggestions update as you type. Press "/" to focus search.'}
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <FilterButton
            label={locale === 'et' ? 'Kõik kohad' : 'All places'}
            active={typeFilter === 'ALL' && statusFilter === 'ALL'}
            onClick={() => {
              setTypeFilter('ALL');
              setStatusFilter('ALL');
            }}
          />
          <FilterButton
            label={t('beaches', locale)}
            active={typeFilter === 'BEACH'}
            onClick={() => setTypeFilter((value) => (value === 'BEACH' ? 'ALL' : 'BEACH'))}
          />
          <FilterButton
            label={t('pools', locale)}
            active={typeFilter === 'POOL'}
            onClick={() => setTypeFilter((value) => (value === 'POOL' ? 'ALL' : 'POOL'))}
          />
          <FilterButton
            label={t('qualityGood', locale)}
            active={statusFilter === 'GOOD'}
            onClick={() => setStatusFilter((value) => (value === 'GOOD' ? 'ALL' : 'GOOD'))}
          />
          <FilterButton
            label={t('qualityBad', locale)}
            active={statusFilter === 'BAD'}
            onClick={() => setStatusFilter((value) => (value === 'BAD' ? 'ALL' : 'BAD'))}
          />
        </div>
      </section>

      {hasFavorites ? (
        <section className="mt-8">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-[0.12em] text-accent">
              {t('favorites', locale)}
            </h2>
            <span className="rounded-full border border-emerald-100 bg-white px-2 py-0.5 text-xs font-medium text-slate-600">
              {favoritePlaces.length}
            </span>
          </div>

          {favoritesLoading && favoritePlaces.length === 0 ? (
            <div className="rounded-xl border border-emerald-100 bg-card p-4 text-sm text-slate-600">
              {locale === 'et' ? 'Laadin lemmikuid...' : 'Loading favorites...'}
            </div>
          ) : favoritePlaces.length === 0 ? (
            <div className="rounded-xl border border-emerald-100 bg-card p-4 text-sm text-slate-600">
              {locale === 'et'
                ? 'Lemmikuid ei õnnestunud hetkel laadida.'
                : 'Could not load favorites right now.'}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {favoritePlaces.map((place, index) => (
                <div className="fade-up" style={{ animationDelay: `${index * 70}ms` }} key={`favorite-${place.id}`}>
                  <PlaceCard
                    place={place}
                    locale={locale}
                    referenceTimeIso={referenceTimeIso}
                    isFavorite
                    onToggleFavorite={toggleFavorite}
                  />
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <p>
            {searchQuery
              ? locale === 'et'
                ? `Otsing: "${searchQuery}". Näitan ${shownResultsCount} tulemust (maksimaalselt ${visibleResultsLimit}).`
                : `Search: "${searchQuery}". Showing ${shownResultsCount} of up to ${visibleResultsLimit} results.`
              : locale === 'et'
                ? `Kuvan ${shownResultsCount} viimati uuendatud kohta.`
                : `Showing ${shownResultsCount} most recently updated places.`}
          </p>
          {loading ? <p>{locale === 'et' ? 'Uuendan tulemusi...' : 'Updating results...'}</p> : null}
        </div>

        {error ? (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
        ) : null}

        {places.length === 0 && !loading ? (
          <div className="rounded-xl border border-emerald-100 bg-card p-4 text-sm text-slate-600">
            {locale === 'et'
              ? 'Sobivaid kohti ei leitud valitud filtritega.'
              : 'No places found with the selected filters.'}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {visiblePlaces.map((place, index) => (
              <div className="fade-up" style={{ animationDelay: `${index * 70}ms` }} key={place.id}>
                <PlaceCard
                  place={place}
                  locale={locale}
                  referenceTimeIso={referenceTimeIso}
                  isFavorite={favoriteIdSet.has(place.id)}
                  onToggleFavorite={toggleFavorite}
                />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};
