import type { PlaceWithLatestReading } from '@veevalve/core';

import { QualityBadge } from './status-badge';

export interface PlaceCardProps {
  place: PlaceWithLatestReading;
}

const formatSampledAt = (value: string): string =>
  new Intl.DateTimeFormat('et-EE', {
    timeZone: 'Europe/Tallinn',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));

export const PlaceCard = ({ place }: PlaceCardProps) => {
  return (
    <article className="rounded-xl border border-emerald-100 bg-card p-4 shadow-card transition hover:-translate-y-0.5">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-ink">{place.nameEt}</h3>
          <p className="text-sm text-slate-600">{place.municipality}</p>
        </div>
        <QualityBadge status={place.latestReading?.status ?? 'UNKNOWN'} />
      </header>
      <p className="mt-3 text-sm text-slate-700">{place.addressEt ?? 'Aadress puudub'}</p>
      <p className="mt-3 text-xs text-slate-500">
        Viimane proov: {place.latestReading ? formatSampledAt(place.latestReading.sampledAt) : '—'}
      </p>
    </article>
  );
};
