import type { QualityStatus } from '@veevalve/core';
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

const labels: Record<QualityStatus, string> = {
  GOOD: 'Hea',
  BAD: 'Halb',
  UNKNOWN: 'Teadmata',
};

export interface QualityBadgeProps {
  status: QualityStatus;
  className?: string;
}

export const QualityBadge = ({ status, className }: QualityBadgeProps) => {
  return <span className={cn(styles({ status }), className)}>{labels[status]}</span>;
};
