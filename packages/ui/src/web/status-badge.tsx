import { t, type AppLocale, type QualityStatus } from '@veevalve/core';
import { cva } from 'class-variance-authority';

import { cn } from './cn';

const styles = cva('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold', {
  variants: {
    status: {
      GOOD: 'bg-emerald-100 text-emerald-700',
      BAD: 'bg-rose-100 text-rose-700',
      UNKNOWN: 'bg-slate-100 text-slate-700',
    },
  },
  defaultVariants: {
    status: 'UNKNOWN',
  },
});

const labelKeys: Record<QualityStatus, 'qualityGood' | 'qualityBad' | 'qualityUnknown'> = {
  GOOD: 'qualityGood',
  BAD: 'qualityBad',
  UNKNOWN: 'qualityUnknown',
};

export interface QualityBadgeProps {
  status: QualityStatus;
  locale?: AppLocale;
  className?: string;
}

export const QualityBadge = ({ status, locale = 'et', className }: QualityBadgeProps) => {
  return <span className={cn(styles({ status }), className)}>{t(labelKeys[status], locale)}</span>;
};
