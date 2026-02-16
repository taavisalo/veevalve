import { t, type AppLocale, type QualityStatus } from '@veevalve/core/client';
import { cva } from 'class-variance-authority';

import { cn } from './cn';

const styles = cva(
  'inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset',
  {
  variants: {
    status: {
      GOOD: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
      BAD: 'bg-rose-100 text-rose-800 ring-rose-200',
      UNKNOWN: 'bg-slate-100 text-slate-700 ring-slate-200',
    },
  },
  defaultVariants: {
    status: 'UNKNOWN',
  },
},
);

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

export const QualityBadge = ({ status, locale = 'et', className, trailingSymbol }: QualityBadgeProps) => {
  return (
    <span className={cn(styles({ status }), className)}>
      <span>{t(labelKeys[status], locale)}</span>
      {trailingSymbol ? (
        <span aria-hidden className="text-xs leading-none">
          {trailingSymbol}
        </span>
      ) : null}
    </span>
  );
};
