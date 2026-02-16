import type { AppLocale, PlaceWithLatestReading } from '@veevalve/core';
import { useState } from 'react';

import { QualityBadge } from './status-badge';

export interface PlaceCardProps {
  place: PlaceWithLatestReading;
  locale?: AppLocale;
  referenceTimeIso?: string;
  isFavorite?: boolean;
  onToggleFavorite?: (placeId: string) => void;
}

const GOOGLE_MAPS_SEARCH_URL = 'https://www.google.com/maps/search/';

const formatSampledAtRelative = (
  sampledAtIso: string,
  locale: AppLocale,
  referenceTimeIso: string | undefined,
): string => {
  const sampledDate = toValidDate(sampledAtIso);
  if (!sampledDate) {
    return sampledAtIso;
  }

  const referenceDate = toValidDate(referenceTimeIso ?? '') ?? new Date();
  const diffMs = sampledDate.getTime() - referenceDate.getTime();
  const absDiffMs = Math.abs(diffMs);

  const relativeUnits = [
    { unit: 'year', milliseconds: 365 * 24 * 60 * 60 * 1000 },
    { unit: 'month', milliseconds: 30 * 24 * 60 * 60 * 1000 },
    { unit: 'week', milliseconds: 7 * 24 * 60 * 60 * 1000 },
    { unit: 'day', milliseconds: 24 * 60 * 60 * 1000 },
    { unit: 'hour', milliseconds: 60 * 60 * 1000 },
    { unit: 'minute', milliseconds: 60 * 1000 },
    { unit: 'second', milliseconds: 1000 },
  ] as const;

  const matchedUnit = relativeUnits.find(({ milliseconds }) => absDiffMs >= milliseconds);
  const formatter = new Intl.RelativeTimeFormat(locale === 'en' ? 'en-GB' : 'et-EE', {
    numeric: 'always',
    style: 'long',
  });

  if (!matchedUnit) {
    return formatter.format(0, 'second');
  }

  const amount = Math.round(diffMs / matchedUnit.milliseconds);
  return formatter.format(amount, matchedUnit.unit);
};

const toValidDate = (value: string): Date | undefined => {
  const parsedDate = new Date(value);
  return Number.isNaN(parsedDate.getTime()) ? undefined : parsedDate;
};

const buildGoogleMapsSearchUrl = (address: string): string => {
  const url = new URL(GOOGLE_MAPS_SEARCH_URL);
  url.searchParams.set('api', '1');
  url.searchParams.set('query', address);
  return url.toString();
};

export const PlaceCard = ({
  place,
  locale = 'et',
  referenceTimeIso,
  isFavorite = false,
  onToggleFavorite,
}: PlaceCardProps) => {
  const placeName = locale === 'en' ? place.nameEn : place.nameEt;
  const placeAddress = locale === 'en' ? place.addressEn : place.addressEt;
  const missingAddressText = locale === 'en' ? 'Address unavailable' : 'Aadress puudub';
  const latestSampleLabel = locale === 'en' ? 'Last sample:' : 'Viimane proov:';
  const mapsSearchQuery =
    place.type === 'BEACH'
      ? [placeName, place.municipality].filter((part) => part.trim().length > 0).join(', ')
      : (placeAddress ?? placeName);
  const [showExactSampledAt, setShowExactSampledAt] = useState(false);

  const sampledDate = place.latestReading ? toValidDate(place.latestReading.sampledAt) : undefined;
  const exactSampledAtIso = place.latestReading
    ? (sampledDate?.toISOString() ?? place.latestReading.sampledAt)
    : undefined;
  const relativeSampledAt = place.latestReading
    ? formatSampledAtRelative(place.latestReading.sampledAt, locale, referenceTimeIso)
    : undefined;
  const mapsAddressUrl = mapsSearchQuery ? buildGoogleMapsSearchUrl(mapsSearchQuery) : undefined;
  const openAddressLabel =
    locale === 'en'
      ? `Open location in Google Maps: ${mapsSearchQuery ?? ''}`
      : `Ava asukoht Google Mapsis: ${mapsSearchQuery ?? ''}`;
  const toggleFavoriteLabel =
    locale === 'en'
      ? (isFavorite ? 'Remove from favorites' : 'Add to favorites')
      : (isFavorite ? 'Eemalda lemmikutest' : 'Lisa lemmikutesse');

  return (
    <article
      className={`relative overflow-visible rounded-xl border border-emerald-100 bg-card p-4 shadow-card transition hover:-translate-y-0.5 ${
        showExactSampledAt ? 'z-30' : ''
      }`}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-ink">{placeName}</h3>
          <p className="text-sm text-slate-600">{place.municipality}</p>
        </div>
        <div className="flex items-center gap-2">
          {onToggleFavorite ? (
            <button
              type="button"
              aria-label={toggleFavoriteLabel}
              aria-pressed={isFavorite}
              title={toggleFavoriteLabel}
              onClick={() => onToggleFavorite(place.id)}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-base leading-none transition ${
                isFavorite
                  ? 'border-amber-300 bg-amber-50 text-amber-600'
                  : 'border-emerald-100 bg-white text-slate-500 hover:border-amber-300 hover:text-amber-600'
              }`}
            >
              {isFavorite ? '★' : '☆'}
            </button>
          ) : null}
          <QualityBadge status={place.latestReading?.status ?? 'UNKNOWN'} locale={locale} />
        </div>
      </header>
      {placeAddress && mapsAddressUrl ? (
        <a
          href={mapsAddressUrl}
          target="_blank"
          rel="noopener noreferrer nofollow external"
          referrerPolicy="no-referrer"
          aria-label={openAddressLabel}
          className="mt-3 inline-flex max-w-full items-start gap-1.5 text-sm text-accent underline decoration-dotted underline-offset-2 hover:text-emerald-700"
        >
          <span className="text-left text-slate-700">{placeAddress}</span>
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent"
          >
            <path
              d="M7 4h9v9h-2V7.41l-8.29 8.3-1.42-1.42L12.59 6H7V4Z"
              fill="currentColor"
            />
          </svg>
        </a>
      ) : (
        <p className="mt-3 text-sm text-slate-700">{missingAddressText}</p>
      )}
      <p className="mt-3 text-xs text-slate-500">
        {latestSampleLabel}{' '}
        {place.latestReading && exactSampledAtIso && relativeSampledAt ? (
          <span className="relative inline-flex items-center">
            <button
              type="button"
              title={exactSampledAtIso}
              onClick={() => setShowExactSampledAt((value) => !value)}
              className="underline decoration-dotted underline-offset-2 hover:text-accent"
            >
              <time dateTime={exactSampledAtIso}>{relativeSampledAt}</time>
            </button>
            {showExactSampledAt ? (
              <span className="pointer-events-none absolute left-0 top-full z-30 mt-1 whitespace-nowrap rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] text-slate-700 shadow-sm">
                {exactSampledAtIso}
              </span>
            ) : null}
          </span>
        ) : (
          '—'
        )}
      </p>
    </article>
  );
};
