import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Flame, Layers3 } from 'lucide-react';
import api from '@/services/api';
import { dashboardKeys } from '@/lib/query-keys';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface CountGroup {
  code?: string;
  count?: number;
}

interface QueueSummary {
  open: number;
  atRisk: number;
  processed7d: number;
  byPriority: CountGroup[];
}

const cards = [
  { key: 'open', label: 'Tickets activos', icon: Layers3, tone: 'text-mrt-info bg-mrt-info/10' },
  { key: 'critical', label: 'Prioridad crítica', icon: Flame, tone: 'text-mrt-bad bg-mrt-bad/10' },
  { key: 'processed', label: 'Procesados en 7 días', icon: CheckCircle2, tone: 'text-mrt-good bg-mrt-good/10' },
  { key: 'risk', label: 'SLA en riesgo', icon: AlertTriangle, tone: 'text-mrt-warn bg-mrt-warn/10' },
] as const;

export function TicketQueueStats() {
  const { data, isLoading } = useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: () => api.get('/dashboard/summary').then((response) => response.data.data as QueueSummary),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const values = {
    open: data?.open || 0,
    critical: Number(data?.byPriority?.find((item) => item.code === 'P1')?.count || 0),
    processed: data?.processed7d || 0,
    risk: data?.atRisk || 0,
  };

  return (
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Resumen de la cola">
      {cards.map((item) => (
        <Card key={item.key} className="flex min-h-[112px] items-center gap-4 p-4 hover:shadow-sm">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${item.tone}`}>
            <item.icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block text-xs font-bold text-stone-500 dark:text-stone-400">{item.label}</span>
            {isLoading ? <Skeleton className="mt-2 h-7 w-14" /> : <strong className="mt-1 block text-2xl font-extrabold text-stone-900 dark:text-stone-50">{values[item.key]}</strong>}
          </span>
        </Card>
      ))}
    </section>
  );
}
