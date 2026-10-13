import { cn } from '@/lib/utils';

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-lg bg-stone-200 dark:bg-stone-700', className)}
      {...props}
    />
  );
}

export { Skeleton };
