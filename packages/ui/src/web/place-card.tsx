import { t, type AppLocale, type PlaceType, type PlaceWithLatestReading, type QualityStatus } from '@veevalve/core/client';
import { useState } from 'react';

export interface PlaceCardProps {
  place: PlaceWithLatestReading;
  locale?: AppLocale;
  referenceTimeIso?: string;
  isFavorite?: boolean;
  favoriteUpdating?: boolean;
  onToggleFavorite?: (placeId: string) => void;
}

const GOOGLE_MAPS_SEARCH_URL = 'https://www.google.com/maps/search/';
const TERVISEAMET_REPORT_URL = 'https://vtiav.sm.ee/frontpage/show';

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

const toTerviseametTabId = (placeType: PlaceType): string =>
  placeType === 'POOL' ? 'U' : 'A';

const buildTerviseametReportUrl = (externalId: string, placeType: PlaceType): string => {
  const url = new URL(TERVISEAMET_REPORT_URL);
  url.searchParams.set('id', externalId);
  url.searchParams.set('active_tab_id', toTerviseametTabId(placeType));
  return url.toString();
};

const mergeUniqueDetails = (details: string[], fallbackDetail: string | undefined): string[] => {
  const merged: string[] = [];
  const seen = new Set<string>();

  for (const candidate of details) {
    const detail = candidate.trim();
    if (!detail) {
      continue;
    }

    const key = detail.toLocaleLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    merged.push(detail);
  }

  if (merged.length > 0) {
    return merged;
  }

  const fallback = fallbackDetail?.trim() ?? '';
  if (!fallback) {
    return merged;
  }

  merged.push(fallback);
  return merged;
};

const getStatusCardBorderClass = (status: QualityStatus): string => {
  if (status === 'BAD') {
    return 'border-rose-200';
  }

  if (status === 'GOOD') {
    return 'border-emerald-200';
  }

  return 'border-slate-200';
};

const getStatusPanelClass = (status: QualityStatus): string => {
  if (status === 'BAD') {
    return 'border-rose-300 bg-gradient-to-r from-rose-100 to-rose-50';
  }

  if (status === 'GOOD') {
    return 'border-emerald-300 bg-gradient-to-r from-emerald-100 to-emerald-50';
  }

  return 'border-slate-300 bg-gradient-to-r from-slate-100 to-slate-50';
};

const getStatusPanelTextClass = (status: QualityStatus): string => {
  if (status === 'BAD') {
    return 'text-rose-900';
  }

  if (status === 'GOOD') {
    return 'text-emerald-900';
  }

  return 'text-slate-800';
};

const getStatusIconWrapClass = (status: QualityStatus): string => {
  if (status === 'BAD') {
    return 'bg-rose-200 text-rose-800';
  }

  if (status === 'GOOD') {
    return 'bg-emerald-200 text-emerald-800';
  }

  return 'bg-slate-200 text-slate-700';
};

const getStatusSymbol = (status: QualityStatus): string => {
  if (status === 'BAD') {
    return '!';
  }

  if (status === 'GOOD') {
    return '✓';
  }

  return '?';
};

const statusLabelKeyByStatus: Record<QualityStatus, 'qualityGood' | 'qualityBad' | 'qualityUnknown'> = {
  GOOD: 'qualityGood',
  BAD: 'qualityBad',
  UNKNOWN: 'qualityUnknown',
};

export const PlaceCard = ({
  place,
  locale = 'et',
  referenceTimeIso,
  isFavorite = false,
  favoriteUpdating = false,
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
  const [showBadDetails, setShowBadDetails] = useState(false);

  const sampledDate = place.latestReading ? toValidDate(place.latestReading.sampledAt) : undefined;
  const exactSampledAtIso = place.latestReading
    ? (sampledDate?.toISOString() ?? place.latestReading.sampledAt)
    : undefined;
  const relativeSampledAt = place.latestReading
    ? formatSampledAtRelative(place.latestReading.sampledAt, locale, referenceTimeIso)
    : undefined;
  const mapsAddressUrl = mapsSearchQuery ? buildGoogleMapsSearchUrl(mapsSearchQuery) : undefined;
  const reportExternalId = place.externalId.trim();
  const fullReportUrl =
    reportExternalId.length > 0
      ? buildTerviseametReportUrl(reportExternalId, place.type)
      : undefined;
  const openAddressLabel =
    locale === 'en'
      ? `Open location in Google Maps: ${mapsSearchQuery ?? ''}`
      : `Ava asukoht Google Mapsis: ${mapsSearchQuery ?? ''}`;
  const toggleFavoriteLabel =
    locale === 'en'
      ? (isFavorite ? 'Remove from favorites' : 'Add to favorites')
      : (isFavorite ? 'Eemalda lemmikutest' : 'Lisa lemmikutesse');
  const toggleFavoriteUpdatingLabel =
    locale === 'en' ? 'Updating favorite...' : 'Uuendan lemmikut...';
  const favoriteButtonLabel = favoriteUpdating ? toggleFavoriteUpdatingLabel : toggleFavoriteLabel;
  const status = place.latestReading?.status ?? 'UNKNOWN';
  const statusLabel = t(statusLabelKeyByStatus[status], locale);
  const isBadStatus = status === 'BAD';
  const badDetailCandidates =
    locale === 'en'
      ? (place.latestReading?.badDetailsEn ?? place.latestReading?.badDetailsEt ?? [])
      : (place.latestReading?.badDetailsEt ?? place.latestReading?.badDetailsEn ?? []);
  const statusReason =
    place.latestReading
      ? (locale === 'en' ? place.latestReading.statusReasonEn : place.latestReading.statusReasonEt)
      : undefined;
  const badDetails = mergeUniqueDetails(badDetailCandidates, statusReason);
  const badDetailsToggleLabel =
    locale === 'en'
      ? (showBadDetails ? 'Hide details' : 'Show details')
      : (showBadDetails ? 'Peida detailid' : 'Näita detaile');
  const statusPanelTitle = locale === 'en' ? 'Water quality' : 'Vee kvaliteet';
  const statusInlineHint =
    status === 'BAD'
      ? (showBadDetails
          ? (locale === 'en' ? 'Hide details' : 'Peida detailid')
          : (locale === 'en' ? 'Show details' : 'Näita detaile'))
      : status === 'GOOD'
        ? (locale === 'en' ? 'Compliant' : 'Korras')
        : (locale === 'en' ? 'No rating' : 'Hinnang puudub');
  const badDetailsFallbackText =
    locale === 'en'
      ? 'The source did not include additional detailed reasons.'
      : 'Allikandmed ei sisaldanud täpsemaid põhjuseid.';
  const fullReportLabel =
    locale === 'en'
      ? 'Open full report on Terviseamet'
      : 'Ava täielik raport Terviseameti lehel';

  return (
    <article
      className={`relative overflow-visible rounded-xl border bg-card p-4 shadow-card transition hover:-translate-y-0.5 ${getStatusCardBorderClass(status)} ${
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
              aria-label={favoriteButtonLabel}
              aria-pressed={isFavorite}
              aria-busy={favoriteUpdating}
              title={favoriteButtonLabel}
              onClick={() => onToggleFavorite(place.id)}
              disabled={favoriteUpdating}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-base leading-none transition ${
                favoriteUpdating
                  ? 'cursor-wait border-accent/40 bg-emerald-50 text-accent'
                  : isFavorite
                    ? 'border-amber-300 bg-amber-50 text-amber-600'
                    : 'border-emerald-100 bg-white text-slate-500 hover:border-amber-300 hover:text-amber-600'
              }`}
            >
              {favoriteUpdating ? (
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"
                />
              ) : (
                isFavorite ? '★' : '☆'
              )}
            </button>
          ) : null}
        </div>
      </header>
      {isBadStatus ? (
        <div className={`mt-3 w-full rounded-xl border p-3 ${getStatusPanelClass(status)}`}>
          <button
            type="button"
            onClick={() => setShowBadDetails((value) => !value)}
            aria-expanded={showBadDetails}
            aria-label={badDetailsToggleLabel}
            title={badDetailsToggleLabel}
            className="w-full text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden
                  className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-black ${getStatusIconWrapClass(status)}`}
                >
                  {getStatusSymbol(status)}
                </span>
                <div>
                  <p className={`text-[11px] font-semibold uppercase tracking-wide ${getStatusPanelTextClass(status)}`}>
                    {statusPanelTitle}
                  </p>
                  <p className={`mt-0.5 text-sm font-extrabold leading-tight ${getStatusPanelTextClass(status)}`}>
                    {statusLabel}
                    <span className="ml-1.5 text-xs font-semibold opacity-90">• {statusInlineHint}</span>
                  </p>
                </div>
              </div>
              <span className={`text-lg font-bold ${getStatusPanelTextClass(status)}`} aria-hidden>
                {showBadDetails ? '▾' : '▸'}
              </span>
            </div>
          </button>
          {showBadDetails ? (
            <div className="mt-2 border-t border-rose-200/80 pt-2">
              {badDetails.length > 0 ? (
                <ul className="list-disc space-y-1 pl-4 text-xs text-rose-900">
                  {badDetails.map((detail) => (
                    <li key={`${place.id}-bad-detail-${detail}`} className="leading-5">
                      {detail}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-rose-800">{badDetailsFallbackText}</p>
              )}
              {fullReportUrl ? (
                <a
                  href={fullReportUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow external"
                  referrerPolicy="no-referrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-rose-700 underline decoration-dotted underline-offset-2 hover:text-rose-800"
                >
                  <span>{fullReportLabel}</span>
                  <span aria-hidden>↗</span>
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : (
        <div className={`mt-3 rounded-xl border p-3 ${getStatusPanelClass(status)}`}>
          <div className="flex items-center gap-3">
            <span
              aria-hidden
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-black ${getStatusIconWrapClass(status)}`}
            >
              {getStatusSymbol(status)}
            </span>
            <div>
              <p className={`text-[11px] font-semibold uppercase tracking-wide ${getStatusPanelTextClass(status)}`}>
                {statusPanelTitle}
              </p>
              <p className={`mt-0.5 text-sm font-extrabold leading-tight ${getStatusPanelTextClass(status)}`}>
                {statusLabel}
                <span className="ml-1.5 text-xs font-semibold opacity-90">• {statusInlineHint}</span>
              </p>
            </div>
          </div>
        </div>
      )}
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
