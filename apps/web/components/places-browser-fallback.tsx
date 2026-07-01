import type { AppLocale } from '@veevalve/core/client';

const fallbackFilterPillWidthClasses = ['w-[90px]', 'w-[72px]', 'w-[72px]', 'w-[84px]', 'w-[76px]'];

export const PlacesBrowserFallback = ({ locale = 'et' }: { locale?: AppLocale }) => {
  return (
    <main
      className="mx-auto max-w-6xl px-3 pb-16 pt-6 sm:px-4 sm:pt-8 md:px-8 md:pt-14"
      aria-busy="true"
    >
      <section className="relative overflow-hidden rounded-3xl border border-emerald-200/70 bg-white/75 p-4 shadow-card backdrop-blur dark:border-teal-400/20 dark:bg-slate-950/60 sm:p-6 md:p-8">
        <div className="flex items-start justify-between gap-2">
          <p className="shrink-0 text-xs uppercase tracking-[0.08em] text-accent sm:text-sm sm:tracking-[0.14em]">
            VeeValve
          </p>
          <div className="flex flex-nowrap items-center justify-end gap-1 sm:gap-1.5">
            <span className="h-6 w-6 rounded-full border border-emerald-100 bg-white dark:border-teal-400/30 dark:bg-slate-900 sm:h-7 sm:w-7" />
            <span className="h-6 w-11 rounded-full border border-emerald-100 bg-white dark:border-teal-400/30 dark:bg-slate-900 sm:h-7 sm:w-12" />
            <span className="h-6 w-16 rounded-full border border-emerald-100 bg-white dark:border-teal-400/30 dark:bg-slate-900 sm:h-7 sm:w-20" />
          </div>
        </div>

        <h1 className="mt-3 text-3xl leading-tight text-ink sm:text-4xl md:text-5xl">
          {locale === 'et'
            ? 'Vee kvaliteet randades ja basseinides'
            : 'Water quality for beaches and pools'}
        </h1>

        <div className="mt-5 max-w-3xl">
          <div className="h-14 rounded-2xl border border-emerald-200 bg-white shadow-card dark:border-teal-400/25 dark:bg-slate-950/80" />
          <div className="mt-2 h-4 w-2/3 max-w-md rounded bg-emerald-100/80 dark:bg-teal-300/15" />
        </div>

        <div className="-mx-0.5 mt-5 overflow-hidden pb-1">
          <div className="flex min-w-max items-center gap-1 px-0.5">
            {fallbackFilterPillWidthClasses.map((widthClass, index) => (
              <span
                key={`${widthClass}-${index}`}
                className={`h-7 ${widthClass} rounded-full border border-emerald-100 bg-white dark:border-teal-400/25 dark:bg-slate-900`}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="sr-only">{locale === 'et' ? 'Tulemused' : 'Results'}</h2>
        <div className="mb-3 h-4 w-48 rounded bg-emerald-100/80 dark:bg-teal-300/15" />
        <div className="grid gap-4 md:grid-cols-2" role="status">
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className="min-h-52 rounded-xl border border-emerald-100 bg-card p-4 shadow-card dark:border-teal-400/20"
            >
              <div className="h-4 w-24 rounded bg-emerald-100/80 dark:bg-teal-300/15" />
              <div className="mt-4 h-7 w-2/3 rounded bg-emerald-100/80 dark:bg-teal-300/15" />
              <div className="mt-3 h-4 w-1/2 rounded bg-emerald-100/80 dark:bg-teal-300/15" />
              <div className="mt-6 h-16 rounded-lg bg-emerald-100/80 dark:bg-teal-300/15" />
            </div>
          ))}
          <span className="sr-only">
            {locale === 'et' ? 'Laadin tulemusi...' : 'Loading results...'}
          </span>
        </div>
      </section>
    </main>
  );
};
