import type { AppLocale } from '@veevalve/core/client';

import type { PlaceMetrics } from '../lib/fetch-place-metrics';

interface MetricsPanelProps {
  locale: AppLocale;
  metrics: PlaceMetrics;
  metricsLoading: boolean;
  metricsExpanded: boolean;
  badShare: string;
  formattedLatestUpdate: string;
  onToggleExpanded: () => void;
}

export const MetricsPanel = ({
  locale,
  metrics,
  metricsLoading,
  metricsExpanded,
  badShare,
  formattedLatestUpdate,
  onToggleExpanded,
}: MetricsPanelProps) => {
  return (
    <div id="metrics-panel" className="mt-4">
      {metricsLoading ? (
        <p className="mb-2 text-xs text-slate-500">
          {locale === 'et' ? 'Laadin mõõdikuid…' : 'Loading metrics…'}
        </p>
      ) : null}
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
            {formattedLatestUpdate}
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
          onClick={onToggleExpanded}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
            metricsExpanded
              ? 'border-emerald-700 bg-emerald-700 text-white'
              : 'border-emerald-100 bg-white text-emerald-800 hover:border-emerald-700'
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
  );
};
