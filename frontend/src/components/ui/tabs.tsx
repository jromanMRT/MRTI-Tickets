import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'flex gap-1 overflow-x-auto pb-0.5 scrollbar-none',
      className
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg px-4 py-2 text-[0.78rem] font-bold text-stone-500 transition-all duration-150 hover:text-stone-800 hover:bg-stone-100 data-[state=active]:border data-[state=active]:border-stone-200 data-[state=active]:bg-white data-[state=active]:text-stone-900 data-[state=active]:shadow-[inset_0_-2px_rgb(169_120_31)] data-[state=active]:font-extrabold dark:text-stone-400 dark:hover:text-stone-100 dark:hover:bg-stone-700 dark:data-[state=active]:border-stone-600 dark:data-[state=active]:bg-stone-800 dark:data-[state=active]:text-stone-50 cursor-pointer',
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ComponentRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn('mt-4 focus-visible:outline-none', className)}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
