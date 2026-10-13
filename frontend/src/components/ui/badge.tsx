import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[0.7rem] font-bold whitespace-nowrap transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-300',
        status: 'bg-mrt-info/12 text-mrt-info dark:bg-mrt-info/20 dark:text-mrt-info-light',
        'status-resolved': 'bg-mrt-good/12 text-mrt-good dark:bg-mrt-good/20 dark:text-mrt-good-light',
        'status-cancelled': 'bg-stone-100 text-stone-400 dark:bg-stone-700 dark:text-stone-400',
        'status-hold': 'bg-mrt-warn/12 text-mrt-warn dark:bg-mrt-warn/20 dark:text-mrt-warn-light',
        'priority-p1': 'bg-mrt-bad/12 text-mrt-bad font-extrabold dark:bg-mrt-bad/20 dark:text-mrt-bad-light',
        'priority-p2': 'bg-mrt-warn/12 text-mrt-warn dark:bg-mrt-warn/20 dark:text-mrt-warn-light',
        'priority-p3': 'bg-mrt-info/12 text-mrt-info dark:bg-mrt-info/20 dark:text-mrt-info-light',
        'priority-p4': 'bg-stone-100 text-stone-400 dark:bg-stone-700 dark:text-stone-400',
        'sla-overdue': 'bg-mrt-bad/10 text-mrt-bad dark:bg-mrt-bad/20 dark:text-mrt-bad-light',
        'sla-at-risk': 'bg-mrt-warn/10 text-mrt-warn dark:bg-mrt-warn/20 dark:text-mrt-warn-light',
        'sla-on-track': 'bg-mrt-good/10 text-mrt-good dark:bg-mrt-good/20 dark:text-mrt-good-light',
        'sla-completed': 'bg-mrt-good/10 text-mrt-good dark:bg-mrt-good/20 dark:text-mrt-good-light',
        'sla-paused': 'bg-mrt-info/10 text-mrt-info dark:bg-mrt-info/20 dark:text-mrt-info-light',
        'sla-none': 'bg-stone-100 text-stone-400 dark:bg-stone-700 dark:text-stone-400',
        warning: 'bg-mrt-warn/12 text-mrt-warn dark:bg-mrt-warn/20 dark:text-mrt-warn-light',
        success: 'bg-mrt-good/12 text-mrt-good dark:bg-mrt-good/20 dark:text-mrt-good-light',
        danger: 'bg-mrt-bad/12 text-mrt-bad dark:bg-mrt-bad/20 dark:text-mrt-bad-light',
        outline: 'border border-stone-200 text-stone-600 dark:border-stone-600 dark:text-stone-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
