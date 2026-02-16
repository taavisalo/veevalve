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
} from '@veevalve/core';
import { PlaceCard } from '@veevalve/ui/web';
import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { mapPlaceApiRows, type PlaceApiRow } from '../lib/place-api';

const LATEST_RESULTS_LIMIT = 10;
const SEARCH_RESULTS_LIMIT = 20;
const SUGGESTION_LIMIT = 8;
const SEARCH_DEBOUNCE_MS = 180;
const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api').replace(/\/+$/, '');

const getResultsLimit = (search?: string): number =>
  search?.trim() ? SEARCH_RESULTS_LIMIT : LATEST_RESULTS_LIMIT;

interface PlacesBrowserProps {
  initialLocale: AppLocale;
  initialType: PlaceType | 'ALL';
  initialStatus: QualityStatus | 'ALL';
  initialSearch?: string;
  initialPlaces: PlaceWithLatestReading[];
  initialNowIso: string;
}

interface Suggestion {
  id: string;
  name: string;
  municipality: string;
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

export const PlacesBrowser = ({
  initialLocale,
  initialType,
  initialStatus,
  initialSearch,
  initialPlaces,
  initialNowIso,
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
          primary: place.nameEt,
          secondary: place.municipality,
        }),
      }))
      .filter(({ score }) => score >= threshold)
      .sort((left, right) => right.score - left.score);

    const seen = new Set<string>();
    const nextSuggestions: Suggestion[] = [];

    for (const { place } of rankedPlaces) {
      const name = place.nameEt;
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
  }, [places, searchQuery]);

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
        <div className="absolute right-6 top-4" ref={languageContainerRef}>
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
        <p className="text-sm uppercase tracking-[0.14em] text-accent">{t('appName', locale)}</p>
        <h1 className="mt-3 max-w-3xl text-4xl leading-tight text-ink md:text-5xl">
          {locale === 'et'
            ? 'Vee kvaliteet randades ja basseinides'
            : 'Water quality for beaches and pools'}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-slate-700 md:text-lg">{t('subtitle', locale)}</p>

        <div className="mt-7 max-w-3xl" ref={searchContainerRef}>
          <label htmlFor="place-search" className="mb-2 block text-xs font-semibold uppercase tracking-[0.1em] text-accent">
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
                    <p className="mt-0.5 text-xs text-slate-500">{suggestion.municipality}</p>
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

      <section className="mt-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <p>
            {searchQuery
              ? locale === 'et'
                ? `Otsing: "${searchQuery}". Näitan ${shownResultsCount} tulemust (maksimaalselt ${visibleResultsLimit}).`
                : `Search: "${searchQuery}". Showing ${shownResultsCount} of up to ${visibleResultsLimit} results.`
              : locale === 'et'
                ? `Näitan ${shownResultsCount} värskeimat kohta.`
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
                <PlaceCard place={place} locale={locale} referenceTimeIso={referenceTimeIso} />
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
};
