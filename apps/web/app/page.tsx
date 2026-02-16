import { t, type AppLocale, type PlaceType, type QualityStatus } from '@veevalve/core';
import { PlaceCard } from '@veevalve/ui/web';

import { FilterChip } from '../components/filter-chip';
import { filterPlaces } from '../lib/filter-places';
import { mockPlaces } from '../lib/mock-places';

interface HomePageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

const normalizeLocale = (value?: string): AppLocale => (value === 'en' ? 'en' : 'et');

const normalizeType = (value?: string): PlaceType | 'ALL' => {
  if (value === 'POOL' || value === 'BEACH') {
    return value;
  }

  return 'ALL';
};

const normalizeStatus = (value?: string): QualityStatus | 'ALL' => {
  if (value === 'GOOD' || value === 'BAD' || value === 'UNKNOWN') {
    return value;
  }

  return 'ALL';
};

const createHref = (
  locale: AppLocale,
  type: PlaceType | 'ALL',
  status: QualityStatus | 'ALL',
) => {
  const params = new URLSearchParams();
  params.set('locale', locale);
  if (type !== 'ALL') {
    params.set('type', type);
  }
  if (status !== 'ALL') {
    params.set('status', status);
  }

  return `/?${params.toString()}`;
};

const readParam = (
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | undefined => {
  const raw = params[key];
  return Array.isArray(raw) ? raw[0] : raw;
};

const HomePage = async ({ searchParams }: HomePageProps) => {
  const resolvedSearchParams = searchParams ? await searchParams : {};

  const locale = normalizeLocale(readParam(resolvedSearchParams, 'locale'));
  const type = normalizeType(readParam(resolvedSearchParams, 'type'));
  const status = normalizeStatus(readParam(resolvedSearchParams, 'status'));
  const search = readParam(resolvedSearchParams, 'q');

  const filtered = filterPlaces({ places: mockPlaces, type, status, search });

  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-10 md:px-8 md:pt-14">
      <section className="fade-up relative overflow-hidden rounded-3xl border border-emerald-200/70 bg-white/75 p-8 shadow-card backdrop-blur">
        <div className="absolute right-6 top-4 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-accent">
          Eesti + English
        </div>
        <p className="text-sm uppercase tracking-[0.14em] text-accent">{t('appName', locale)}</p>
        <h1 className="mt-3 max-w-3xl text-4xl leading-tight text-ink md:text-5xl">
          {locale === 'et'
            ? 'Reaalajas vee kvaliteet randades ja basseinides'
            : 'Real-time water quality for beaches and pools'}
        </h1>
        <p className="mt-4 max-w-2xl text-base text-slate-700 md:text-lg">{t('subtitle', locale)}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <FilterChip
            href={createHref(locale === 'et' ? 'en' : 'et', type, status)}
            label={locale === 'et' ? 'Switch to English' : 'Vaheta eesti keelde'}
            active={false}
          />
          <FilterChip
            href={createHref(locale, 'ALL', status)}
            label={locale === 'et' ? 'Kõik kohad' : 'All places'}
            active={type === 'ALL'}
          />
          <FilterChip
            href={createHref(locale, 'BEACH', status)}
            label={t('beaches', locale)}
            active={type === 'BEACH'}
          />
          <FilterChip
            href={createHref(locale, 'POOL', status)}
            label={t('pools', locale)}
            active={type === 'POOL'}
          />
          <FilterChip
            href={createHref(locale, type, 'GOOD')}
            label={t('qualityGood', locale)}
            active={status === 'GOOD'}
          />
          <FilterChip
            href={createHref(locale, type, 'BAD')}
            label={t('qualityBad', locale)}
            active={status === 'BAD'}
          />
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-2">
        {filtered.map((place, index) => (
          <div className="fade-up" style={{ animationDelay: `${index * 70}ms` }} key={place.id}>
            <PlaceCard place={place} />
          </div>
        ))}
      </section>
    </main>
  );
};

export default HomePage;
