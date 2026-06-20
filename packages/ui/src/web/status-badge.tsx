import { t, type AppLocale, type QualityStatus } from '@veevalve/core/client';

const baseClassName =
  'inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset';

const statusClassNames: Record<QualityStatus, string> = {
  GOOD: 'bg-emerald-100 text-emerald-800 ring-emerald-200 dark:bg-teal-300/15 dark:text-teal-100 dark:ring-teal-300/30',
  BAD: 'bg-rose-100 text-rose-800 ring-rose-200 dark:bg-rose-400/15 dark:text-rose-100 dark:ring-rose-300/30',
  UNKNOWN:
    'bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-700/70 dark:text-slate-100 dark:ring-slate-500',
};

const labelKeys: Record<QualityStatus, 'qualityGood' | 'qualityBad' | 'qualityUnknown'> = {
  GOOD: 'qualityGood',
  BAD: 'qualityBad',
  UNKNOWN: 'qualityUnknown',
};

export interface QualityBadgeProps {
  status: QualityStatus;
  locale?: AppLocale;
  className?: string;
  trailingSymbol?: string;
}

export const QualityBadge = ({
  status,
  locale = 'et',
  className,
  trailingSymbol,
}: QualityBadgeProps) => {
  const badgeClassName = className
    ? `${baseClassName} ${statusClassNames[status]} ${className}`
    : `${baseClassName} ${statusClassNames[status]}`;

  return (
    <span className={badgeClassName}>
      <span>{t(labelKeys[status], locale)}</span>
      {trailingSymbol ? (
        <span aria-hidden className="text-xs leading-none">
          {trailingSymbol}
        </span>
      ) : null}
    </span>
  );
};
