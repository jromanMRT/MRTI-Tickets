import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { Plus, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { dashboardKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface CountGroup { code?: string; id?: number; name: string; count?: number; open?: number; overdue?: number; high_priority?: number; processed?: number; avg_resolution_hours?: number }
interface RecentTicket { id: number; folio: string; title: string; status_code: string; status_name: string; priority_code: string; business_area_name: string; assigned_to_name?: string; sla_state: string; updated_at: string; resolution_hours?: number }
interface TrendPoint { day: string; count: number }
interface Summary {
  total: number; open: number; new: number; inProgress: number; waiting: number; resolved: number; closed: number;
  overdue: number; atRisk: number; unassigned: number; averageOpenAgeHours: number;
  processed7d: number; avgResolutionHours: number;
  byPriority: CountGroup[]; byArea: CountGroup[]; workload: CountGroup[]; recent: RecentTicket[];
  trend: { created: TrendPoint[]; resolved: TrendPoint[] };
  processedRecent: RecentTicket[];
  processedByArea: CountGroup[];
}

const GOLD = 'rgb(201, 151, 47)';
const GREEN = 'rgb(111, 207, 140)';
const RED = 'rgb(224, 138, 114)';
const AMBER = 'rgb(243, 191, 94)';
const INFO = 'rgb(142, 194, 224)';
const PRIORITY_COLORS: Record<string, string> = { P1: RED, P2: AMBER, P3: INFO, P4: 'rgb(168, 149, 111)' };

function shortDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' }).format(new Date(value));
}

function formatHours(hours: number) {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 24) return `${Math.round(hours)} h`;
  const days = Math.floor(hours / 24);
  const remaining = Math.round(hours % 24);
  return remaining ? `${days} d ${remaining} h` : `${days} d`;
}

function useChartTheme() {
  const isDark = document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && window.matchMedia('(prefers-color-scheme: dark)').matches);
  return {
    text: isDark ? 'rgb(168, 149, 111)' : 'rgb(142, 125, 93)',
    grid: isDark ? 'rgb(58, 46, 28)' : 'rgb(235, 226, 200)',
    tooltipBg: isDark ? 'rgb(42, 34, 22)' : 'rgb(255, 255, 255)',
    tooltipBorder: isDark ? 'rgb(74, 58, 34)' : 'rgb(225, 211, 171)',
  };
}

const slaVariantMap: Record<string, 'sla-overdue' | 'sla-at-risk' | 'sla-on-track' | 'sla-completed' | 'sla-paused' | 'sla-none'> = {
  completed: 'sla-completed', none: 'sla-none', paused: 'sla-paused', overdue: 'sla-overdue', at_risk: 'sla-at-risk', on_track: 'sla-on-track',
};
const priorityVariantMap: Record<string, 'priority-p1' | 'priority-p2' | 'priority-p3' | 'priority-p4'> = {
  p1: 'priority-p1', p2: 'priority-p2', p3: 'priority-p3', p4: 'priority-p4',
};
const statusVariant = (code: string) => {
  const lower = code.toLowerCase();
  if (lower === 'resolved' || lower === 'closed') return 'status-resolved' as const;
  if (lower === 'cancelled') return 'status-cancelled' as const;
  if (lower.startsWith('on_hold')) return 'status-hold' as const;
  return 'status' as const;
};

function StatCard({ label, value, sub, tone, to, delay }: { label: string; value: number; sub: string; tone?: string; to: string; delay: number }) {
  const toneClasses: Record<string, string> = {
    primary: 'border-ore-400/40 bg-gradient-to-br from-ore-50 to-ore-100/30 dark:from-stone-800 dark:to-ore-600/15',
    danger: 'border-mrt-bad-light/30 hover:border-mrt-bad-light/50',
    warning: 'border-mrt-warn-light/30 hover:border-mrt-warn-light/50',
    success: 'border-mrt-good-light/30 hover:border-mrt-good-light/50',
  };
  const valueTone: Record<string, string> = {
    danger: 'text-mrt-bad dark:text-mrt-bad-light',
    warning: 'text-mrt-warn dark:text-mrt-warn-light',
    success: 'text-mrt-good dark:text-mrt-good-light',
  };
  return (
    <Link
      to={to}
      className={cn(
        'group relative flex flex-col justify-between gap-3 overflow-hidden rounded-2xl border border-stone-200 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5 dark:border-stone-600 dark:bg-stone-800',
        toneClasses[tone || '']
      )}
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="text-[0.68rem] font-extrabold uppercase tracking-widest text-stone-400">{label}</span>
      <strong className={cn('text-4xl font-extrabold leading-none tracking-tight', valueTone[tone || ''] || 'text-stone-900 dark:text-stone-50')}>{value}</strong>
      <small className="text-[0.7rem] leading-relaxed text-stone-400">{sub}</small>
      <div className="pointer-events-none absolute -right-6 -bottom-8 h-24 w-24 rounded-full bg-ore-300/8 transition-transform duration-500 group-hover:scale-125" />
    </Link>
  );
}

function QueueCard({ label, count, detail, tone, to }: { label: string; count: number | null; detail: string; tone?: string; to: string }) {
  const border = tone === 'danger' ? 'border-l-mrt-bad dark:border-l-mrt-bad-light' : tone === 'warning' ? 'border-l-mrt-warn dark:border-l-mrt-warn-light' : '';
  return (
    <Link to={to} className={cn(
      'group flex items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 dark:border-stone-600 dark:bg-stone-800',
      tone && `border-l-3 ${border}`
    )}>
      <div className="min-w-0">
        <span className="block text-sm font-bold text-stone-800 dark:text-stone-100">{label}</span>
        <small className="text-xs text-stone-400">{detail}</small>
      </div>
      {count !== null && <strong className="shrink-0 text-2xl font-extrabold text-stone-800 dark:text-stone-100">{count}</strong>}
    </Link>
  );
}

function slaLabel(state: string) {
  return ({ completed: 'Cumplido', none: 'Sin SLA', paused: 'Pausado', overdue: 'SLA vencido', at_risk: 'En riesgo', on_track: 'En tiempo' } as Record<string, string>)[state] || 'Sin SLA';
}

function Dashboard() {
  const { data: summary, error } = useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: () => api.get('/dashboard/summary').then((res) => res.data.data as Summary),
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  const chartTheme = useChartTheme();

  const trendData = useMemo(() => {
    const created = new Map((summary?.trend.created || []).map((item) => [String(item.day).slice(0, 10), Number(item.count)]));
    const resolved = new Map((summary?.trend.resolved || []).map((item) => [String(item.day).slice(0, 10), Number(item.count)]));
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date();
      day.setHours(12, 0, 0, 0); day.setDate(day.getDate() - (6 - index));
      const key = day.toISOString().slice(0, 10);
      return { name: new Intl.DateTimeFormat('es-MX', { weekday: 'short' }).format(day).slice(0, 3), creados: created.get(key) || 0, resueltos: resolved.get(key) || 0 };
    });
  }, [summary]);

  const priorityData = useMemo(() => (summary?.byPriority || []).map((item) => ({
    name: item.code || item.name, value: Number(item.open || item.count || 0),
    fill: PRIORITY_COLORS[String(item.code)] || INFO,
  })).filter((d) => d.value > 0), [summary]);

  const areaBarData = useMemo(() => (summary?.byArea || []).slice(0, 8).map((area) => ({
    name: area.name.length > 18 ? area.name.slice(0, 16) + '…' : area.name,
    activos: Number(area.open), vencidos: Number(area.overdue || 0),
  })), [summary]);

  const workloadBarData = useMemo(() => (summary?.workload || []).slice(0, 8).map((person) => ({
    name: person.name.split(' ').slice(0, 2).join(' '),
    activos: Number(person.open), alta: Number(person.high_priority || 0),
  })), [summary]);

  if (error) return <div className="rounded-2xl border border-mrt-bad/20 bg-mrt-bad/5 p-6 text-mrt-bad dark:text-mrt-bad-light">No se pudo cargar el centro operativo</div>;
  if (!summary) return (
    <div className="grid gap-6">
      <Skeleton className="h-16 w-80" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36" />)}
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Skeleton className="h-64" /><Skeleton className="h-64" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ore-500 dark:text-ore-300">Mesa de servicio · operación en vivo</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-50 lg:text-4xl">Centro operativo</h1>
          <p className="mt-1 text-sm text-stone-400">Prioriza la demanda, protege los SLA y distribuye la carga del equipo.</p>
        </div>
        <div className="flex gap-2.5">
          <Button variant="secondary" asChild><Link to="/tickets?scope=open">Abrir bandeja</Link></Button>
          <Button asChild><Link to="/tickets/new"><Plus className="mr-1 h-4 w-4" /> Crear ticket</Link></Button>
        </div>
      </div>

      {/* KPI cards */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores principales">
        <StatCard label="Trabajo activo" value={summary.open} sub={`${summary.new} nuevos · ${summary.inProgress} en proceso · ${summary.waiting} en espera`} tone="primary" to="/tickets?scope=open" delay={0} />
        <StatCard label="SLA vencido" value={summary.overdue} sub={summary.overdue ? 'Requiere recuperación inmediata' : 'Sin incumplimientos activos'} tone={summary.overdue ? 'danger' : undefined} to="/tickets?scope=overdue" delay={50} />
        <StatCard label="Próximos a vencer" value={summary.atRisk} sub="80% o más del tiempo consumido" tone={summary.atRisk ? 'warning' : undefined} to="/tickets?scope=at-risk" delay={100} />
        <StatCard label="Procesados (7 días)" value={summary.processed7d} sub={summary.avgResolutionHours ? `Resolución promedio: ${formatHours(summary.avgResolutionHours)}` : 'Sin tickets procesados esta semana'} tone="success" to="/tickets?scope=closed" delay={150} />
      </section>

      {/* Queue cards */}
      <section>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ore-500 dark:text-ore-300">Colas de trabajo</p>
            <h2 className="mt-0.5 text-lg font-extrabold text-stone-900 dark:text-stone-50">Atención prioritaria</h2>
          </div>
          <Link className="flex items-center gap-1 text-xs font-bold text-ore-600 hover:underline dark:text-ore-300" to="/tickets">Ver todas <ArrowRight className="h-3 w-3" /></Link>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QueueCard label="Mis asignados" count={null} detail="Trabajo a mi cargo" to="/tickets?scope=mine" />
          <QueueCard label="Sin asignar" count={summary.unassigned} detail="Requieren responsable" to="/tickets?scope=unassigned" />
          <QueueCard label="SLA vencido" count={summary.overdue} detail="Atención inmediata" tone="danger" to="/tickets?scope=overdue" />
          <QueueCard label="SLA en riesgo" count={summary.atRisk} detail="Consumieron 80% o más" tone="warning" to="/tickets?scope=at-risk" />
        </div>
      </section>

      {/* Charts row: area bars + workload bars */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-4">
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ore-500 dark:text-ore-300">Demanda activa</p>
            <h2 className="mt-0.5 text-base font-bold text-stone-900 dark:text-stone-50">Por área de servicio</h2>
          </div>
          {areaBarData.length ? (
            <ResponsiveContainer width="100%" height={Math.max(areaBarData.length * 42, 180)}>
              <BarChart data={areaBarData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <XAxis type="number" tick={{ fill: chartTheme.text, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={90} tick={{ fill: chartTheme.text, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="activos" fill={GOLD} radius={[0, 4, 4, 0]} barSize={14} name="Activos" />
                <Bar dataKey="vencidos" fill={RED} radius={[0, 4, 4, 0]} barSize={14} name="Vencidos" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="py-8 text-center text-sm text-stone-400">No hay demanda activa.</p>}
        </Card>

        <Card>
          <div className="mb-4">
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ore-500 dark:text-ore-300">Capacidad</p>
            <h2 className="mt-0.5 text-base font-bold text-stone-900 dark:text-stone-50">Carga por responsable</h2>
          </div>
          {workloadBarData.length ? (
            <ResponsiveContainer width="100%" height={Math.max(workloadBarData.length * 42, 180)}>
              <BarChart data={workloadBarData} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <XAxis type="number" tick={{ fill: chartTheme.text, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" width={90} tick={{ fill: chartTheme.text, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="activos" fill={GOLD} radius={[0, 4, 4, 0]} barSize={14} name="Activos" />
                <Bar dataKey="alta" fill={RED} radius={[0, 4, 4, 0]} barSize={14} name="Alta prioridad" />
              </BarChart>
            </ResponsiveContainer>
          ) : <p className="py-8 text-center text-sm text-stone-400">Aún no hay tickets asignados.</p>}
        </Card>
      </div>

      {/* Charts row: priority donut + trend */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-4">
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ore-500 dark:text-ore-300">Distribución</p>
            <h2 className="mt-0.5 text-base font-bold text-stone-900 dark:text-stone-50">Por prioridad</h2>
          </div>
          {priorityData.length ? (
            <div className="flex flex-col items-center gap-6 sm:flex-row">
              <ResponsiveContainer width={160} height={160}>
                <PieChart>
                  <Pie data={priorityData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} strokeWidth={0}>
                    {priorityData.map((entry, index) => <Cell key={index} fill={entry.fill} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="grid gap-2.5">
                {priorityData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: item.fill }} />
                    <span className="font-bold text-stone-800 dark:text-stone-100">{item.name}</span>
                    <span className="text-stone-400">{item.value} tickets</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <p className="py-8 text-center text-sm text-stone-400">Sin tickets activos con prioridad.</p>}
        </Card>

        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ore-500 dark:text-ore-300">Últimos 7 días</p>
              <h2 className="mt-0.5 text-base font-bold text-stone-900 dark:text-stone-50">Entrada y salida</h2>
            </div>
            <div className="flex gap-4 text-[0.66rem] font-bold text-stone-400">
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: GOLD }} /> Creados</span>
              <span className="flex items-center gap-1.5"><span className="inline-block h-2 w-2 rounded-full" style={{ background: GREEN }} /> Resueltos</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={trendData} margin={{ top: 8, right: 8, bottom: 4, left: -20 }}>
              <defs>
                <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GOLD} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradResolved" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={GREEN} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={GREEN} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" tick={{ fill: chartTheme.text, fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: chartTheme.text, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ background: chartTheme.tooltipBg, border: `1px solid ${chartTheme.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} />
              <Area type="monotone" dataKey="creados" stroke={GOLD} fill="url(#gradCreated)" strokeWidth={2.5} name="Creados" dot={false} />
              <Area type="monotone" dataKey="resueltos" stroke={GREEN} fill="url(#gradResolved)" strokeWidth={2.5} name="Resueltos" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Active queue */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ore-500 dark:text-ore-300">Bandeja activa</p>
            <h2 className="mt-0.5 text-base font-bold text-stone-900 dark:text-stone-50">Siguiente trabajo recomendado</h2>
          </div>
          <Link className="flex items-center gap-1 text-xs font-bold text-ore-600 hover:underline dark:text-ore-300" to="/tickets?scope=open&sort=priority">Abrir cola <ArrowRight className="h-3 w-3" /></Link>
        </div>
        {summary.recent.length ? (
          <div className="grid">
            {summary.recent.map((ticket) => (
              <Link to={`/tickets/${ticket.id}`} key={ticket.id} className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 rounded-lg border-b border-stone-100 px-2 py-3.5 transition-colors hover:bg-stone-50/60 last:border-0 sm:grid-cols-[auto_minmax(180px,1fr)_auto_auto] sm:gap-4 dark:border-stone-700 dark:hover:bg-stone-700/30" style={{ textDecoration: 'none', color: 'inherit' }}>
                <Badge variant={priorityVariantMap[ticket.priority_code?.toLowerCase()] || 'default'}>{ticket.priority_code}</Badge>
                <span className="min-w-0">
                  <strong className="block truncate text-sm font-bold text-stone-800 dark:text-stone-100">{ticket.folio} · {ticket.title}</strong>
                  <small className="mt-1 block text-xs text-stone-400">{ticket.business_area_name} · {ticket.assigned_to_name || 'Sin asignar'} · Actualizado {shortDate(ticket.updated_at)}</small>
                </span>
                <div className="col-start-2 flex flex-wrap gap-1.5 sm:col-auto sm:contents">
                  <Badge variant={slaVariantMap[ticket.sla_state] || 'sla-none'}>{slaLabel(ticket.sla_state)}</Badge>
                  <Badge variant={statusVariant(ticket.status_code)}>{ticket.status_name}</Badge>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <h2 className="text-base font-bold text-stone-800 dark:text-stone-100">La bandeja está al día</h2>
            <p className="mt-1 text-sm text-stone-400">No existen tickets activos pendientes.</p>
          </div>
        )}
      </Card>

      {/* Processed */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ore-500 dark:text-ore-300">Resueltos recientemente</p>
            <h2 className="mt-0.5 text-base font-bold text-stone-900 dark:text-stone-50">Tickets procesados</h2>
          </div>
          <Link className="flex items-center gap-1 text-xs font-bold text-ore-600 hover:underline dark:text-ore-300" to="/tickets?scope=closed">Ver todos <ArrowRight className="h-3 w-3" /></Link>
        </div>
        {summary.processedRecent.length ? (
          <div className="grid">
            {summary.processedRecent.map((ticket) => (
              <Link to={`/tickets/${ticket.id}`} key={ticket.id} className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1 rounded-lg border-b border-stone-100 px-2 py-3.5 transition-colors hover:bg-stone-50/60 last:border-0 sm:grid-cols-[auto_minmax(180px,1fr)_auto_auto] sm:gap-4 dark:border-stone-700 dark:hover:bg-stone-700/30" style={{ textDecoration: 'none', color: 'inherit' }}>
                <Badge variant={priorityVariantMap[ticket.priority_code?.toLowerCase()] || 'default'}>{ticket.priority_code}</Badge>
                <span className="min-w-0">
                  <strong className="block truncate text-sm font-bold text-stone-800 dark:text-stone-100">{ticket.folio} · {ticket.title}</strong>
                  <small className="mt-1 block text-xs text-stone-400">{ticket.business_area_name} · {ticket.assigned_to_name || 'Sin asignar'} · {shortDate(ticket.updated_at)}{ticket.resolution_hours != null ? ` · ${formatHours(ticket.resolution_hours)}` : ''}</small>
                </span>
                <div className="col-start-2 flex flex-wrap gap-1.5 sm:col-auto sm:contents">
                  <Badge variant={slaVariantMap[ticket.sla_state] || 'sla-none'}>{slaLabel(ticket.sla_state)}</Badge>
                  <Badge variant={statusVariant(ticket.status_code)}>{ticket.status_name}</Badge>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <h2 className="text-base font-bold text-stone-800 dark:text-stone-100">Sin tickets procesados</h2>
            <p className="mt-1 text-sm text-stone-400">No hay tickets resueltos o cerrados recientemente.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

export default Dashboard;
