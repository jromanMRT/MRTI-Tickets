import * as React from 'react';
import { cn } from '@/lib/utils';

const Avatar = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-ore-200 to-ore-500 text-sm font-extrabold text-stone-900 tracking-wide',
        className
      )}
      {...props}
    />
  )
);
Avatar.displayName = 'Avatar';

export { Avatar };
