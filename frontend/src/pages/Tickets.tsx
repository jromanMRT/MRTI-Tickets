import { type ColumnDef, type SortingState } from '@tanstack/react-table';
import { FormEvent, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MessageSquare, Paperclip, Plus, Search, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { ticketKeys, catalogKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SelectNative } from '@/components/ui/select-native';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { DataTable, type ColumnFiltersState } from '@/components/ui/data-table';
import { exportCsv } from '@/lib/export-csv';

interface TicketRow {
  id: number; folio: string; title: string; status_code: string; status_name: string;
  priority_code: string; priority_name: string; assigned_to_name?: string; requester_name?: string;
  created_at: string; updated_at: string; origin_area_name?: string; origin_site_name?: string;
  affected_device_internal_id?: string; affected_device_name?: string; business_area_name?: string;
  sla_state: 'completed' | 'none' | 'paused' | 'overdue' | 'at_risk' | 'on_track'; sla_deadline_effective?: string;
  comment_count: number; attachment_count: number;
}
interface Option { code: string; name: string }
interface BusinessArea { id: number; name: string; code: string }
interface TicketPage { items: TicketRow[]; page: number; limit: number; total: number; totalPages: number }

const queueOptions = [
  { value: '', label: 'Todos' }, { value: 'open', label: 'Activos' }, { value: 'mine', label: 'Mis asignados' },
  { value: 'unassigned', label: 'Sin asignar' }, { value: 'overdue', label: 'SLA vencido' }, { value: 'at-risk', label: 'En riesgo' },
  { value: 'paused', label: 'En espera' },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

const slaVariantMap: Record<string, 'sla-overdue' | 'sla-at-risk' | 'sla-on-track' | 'sla-completed' | 'sla-paused' | 'sla-none'> = {
  completed: 'sla-completed', none: 'sla-none', paused: 'sla-paused', overdue: 'sla-overdue', at_risk: 'sla-at-risk', on_track: 'sla-on-track',
};
const slaLabelMap: Record<string, string> = {
  completed: 'Cumplido', none: 'Sin SLA', paused: 'Pausado', overdue: 'Vencido', at_risk: 'En riesgo', on_track: 'En tiempo',
};

const priorityVariantMap: Record<string, 'priority-p1' | 'priority-p2' | 'priority-p3' | 'priority-p4'> = {
  p1: 'priority-p1', p2: 'priority-p2', p3: 'priority-p3', p4: 'priority-p4',
};

const statusVariantMap = (code: string) => {
  const lower = code.toLowerCase();
  if (lower === 'resolved' || lower === 'closed') return 'status-resolved' as const;
  if (lower === 'cancelled') return 'status-cancelled' as const;
  if (lower.startsWith('on_hold')) return 'status-hold' as const;
  return 'status' as const;
};

const SORT_MAP: Record<string, string> = {
  updated_at: 'updated', created_at: 'newest', priority_code: 'priority',
};
const SORT_REVERSE: Record<string, string> = {
  updated: 'updated_at', newest: 'created_at', priority: 'priority_code',
};

const columns: ColumnDef<TicketRow, unknown>[] = [
  {
    id: 'ticket',
    accessorKey: 'folio',
    header: 'Ticket',
    enableColumnFilter: true,
    meta: { filterVariant: 'text', filterPlaceholder: 'Folio o texto' },
    size: 280,
    cell: ({ row }) => {
      const t = row.original;
      return (
        <div>
          <div className="flex items-center gap-2">
            <Badge variant={priorityVariantMap[t.priority_code?.toLowerCase()] || 'default'}>{t.priority_code}</Badge>
            <Link className="text-sm font-bold text-ore-600 hover:underline dark:text-ore-300" to={`/tickets/${t.id}`}>{t.folio}</Link>
          </div>
          <strong className="mt-1.5 block max-w-[380px] truncate text-sm text-stone-800 dark:text-stone-100">{t.title}</strong>
          <small className="mt-0.5 block text-xs text-stone-400">{t.origin_area_name || t.origin_site_name || 'Sin ubicación'}{t.affected_device_internal_id ? ` · ${t.affected_device_internal_id}` : ''}</small>
        </div>
      );
    },
    enableSorting: false,
  },
  {
    id: 'area',
    accessorKey: 'business_area_name',
    header: 'Área / solicitante',
    enableColumnFilter: true,
    meta: { filterVariant: 'text', filterPlaceholder: 'ID de área' },
    cell: ({ row }) => (
      <div className="text-sm text-stone-600 dark:text-stone-300">
        {row.original.business_area_name || 'Sin área'}
        <small className="mt-0.5 block text-xs text-stone-400">{row.original.requester_name || 'Sin solicitante'}</small>
      </div>
    ),
    enableSorting: false,
  },
  {
    id: 'status',
    accessorKey: 'status_code',
    header: 'Estado',
    enableColumnFilter: true,
    meta: { filterVariant: 'text', filterPlaceholder: 'Código' },
    cell: ({ row }) => <Badge variant={statusVariantMap(row.original.status_code)}>{row.original.status_name}</Badge>,
    enableSorting: false,
  },
  {
    id: 'sla',
    accessorKey: 'sla_state',
    header: 'SLA',
    enableColumnFilter: false,
    cell: ({ row }) => {
      const t = row.original;
      return (
        <div>
          <Badge variant={slaVariantMap[t.sla_state] || 'sla-none'}>{slaLabelMap[t.sla_state] || 'Sin SLA'}</Badge>
          {t.sla_deadline_effective && !['completed', 'none', 'paused'].includes(t.sla_state) && (
            <small className="mt-0.5 block text-xs text-stone-400">{formatDate(t.sla_deadline_effective)}</small>
          )}
        </div>
      );
    },
    enableSorting: false,
  },
  {
    id: 'assigned',
    accessorKey: 'assigned_to_name',
    header: 'Responsable',
    enableColumnFilter: false,
    cell: ({ row }) => (
      <span className="text-sm text-stone-600 dark:text-stone-300">
        {row.original.assigned_to_name || <span className="font-bold text-mrt-warn dark:text-mrt-warn-light">Sin asignar</span>}
      </span>
    ),
    enableSorting: false,
  },
  {
    id: 'updated_at',
    accessorKey: 'updated_at',
    header: 'Actividad',
    enableColumnFilter: false,
    cell: ({ row }) => {
      const t = row.original;
      return (
        <div>
          <span className="flex gap-2.5 text-xs text-stone-500">
            <span title="Comentarios"><MessageSquare className="mr-0.5 inline h-3 w-3" />{t.comment_count}</span>
            <span title="Adjuntos"><Paperclip className="mr-0.5 inline h-3 w-3" />{t.attachment_count}</span>
          </span>
          <small className="mt-0.5 block text-xs text-stone-400">{formatDate(t.updated_at)}</small>
        </div>
      );
    },
  },
];

function Tickets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [draftQuery, setDraftQuery] = useState(searchParams.get('q') || '');

  const queryKey = searchParams.toString();

  const { data: pageData, isLoading, error } = useQuery({
    queryKey: ticketKeys.list(queryKey),
    queryFn: () => api.get('/tickets', { params: Object.fromEntries(searchParams.entries()) }).then((res) => res.data.data as TicketPage),
    placeholderData: (prev) => prev,
  });

  const { data: statuses = [] } = useQuery({
    queryKey: catalogKeys.statuses(),
    queryFn: () => api.get('/statuses').then((res) => res.data.data as Option[]),
    staleTime: 300_000,
  });

  const { data: areas = [] } = useQuery({
    queryKey: catalogKeys.businessAreas(),
    queryFn: () => api.get('/business-areas').then((res) => res.data.data as BusinessArea[]),
    staleTime: 300_000,
  });

  const tableColumns = useMemo<ColumnDef<TicketRow, unknown>[]>(() => columns.map((column) => {
    if (column.id === 'status') return {
      ...column,
      meta: { filterVariant: 'select', filterOptions: statuses.map((status) => ({ value: status.code, label: status.name })) },
    };
    if (column.id === 'area') return {
      ...column,
      meta: { filterVariant: 'select', filterOptions: areas.map((area) => ({ value: String(area.id), label: area.name })) },
    };
    return column;
  }), [areas, statuses]);

  const activeFilters = ['status', 'priority', 'business_area_id', 'q', 'assigned_to', 'asset_uid'].filter((key) => searchParams.get(key)).length;
  const assetUidFilter = searchParams.get('asset_uid') || '';

  function updateParam(key: string, value: string, resetPage = true) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (resetPage) next.delete('page');
    setSearchParams(next);
  }

  function submit(event: FormEvent) { event.preventDefault(); updateParam('q', draftQuery.trim()); }
  function clearFilters() { setDraftQuery(''); setSearchParams({}); }

  const sorting = useMemo<SortingState>(() => {
    const sortParam = searchParams.get('sort') || 'updated';
    const col = SORT_REVERSE[sortParam];
    return col ? [{ id: col, desc: sortParam !== 'oldest' }] : [];
  }, [searchParams]);

  function handleSortingChange(updater: SortingState | ((old: SortingState) => SortingState)) {
    const next = typeof updater === 'function' ? updater(sorting) : updater;
    if (next.length) {
      const mapped = SORT_MAP[next[0].id];
      if (mapped) updateParam('sort', next[0].desc ? mapped : 'oldest');
    } else {
      updateParam('sort', '');
    }
  }

  const columnFilters = useMemo<ColumnFiltersState>(() => [
    ...(searchParams.get('q') ? [{ id: 'ticket', value: searchParams.get('q')! }] : []),
    ...(searchParams.get('status') ? [{ id: 'status', value: searchParams.get('status')! }] : []),
    ...(searchParams.get('business_area_id') ? [{ id: 'area', value: searchParams.get('business_area_id')! }] : []),
  ], [searchParams]);

  function handleColumnFiltersChange(updater: ColumnFiltersState | ((old: ColumnFiltersState) => ColumnFiltersState)) {
    const next = typeof updater === 'function' ? updater(columnFilters) : updater;
    const valueFor = (id: string) => String(next.find((filter) => filter.id === id)?.value || '');
    const nextParams = new URLSearchParams(searchParams);
    const mappings = [['ticket', 'q'], ['status', 'status'], ['area', 'business_area_id']] as const;
    mappings.forEach(([columnId, param]) => {
      const value = valueFor(columnId);
      if (value) nextParams.set(param, value); else nextParams.delete(param);
    });
    nextParams.delete('page');
    setDraftQuery(valueFor('ticket'));
    setSearchParams(nextParams);
  }

  function handleExportCsv() {
    if (!pageData) return;
    const headers = ['Folio', 'Título', 'Prioridad', 'Estado', 'SLA', 'Área', 'Solicitante', 'Responsable', 'Creado', 'Actualizado'];
    const rows = pageData.items.map((t) => [
      t.folio, t.title, t.priority_code, t.status_name,
      slaLabelMap[t.sla_state] || 'Sin SLA',
      t.business_area_name || '', t.requester_name || '', t.assigned_to_name || '',
      formatDate(t.created_at), formatDate(t.updated_at),
    ]);
    exportCsv(`tickets-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  const current = pageData ?? { items: [], page: 1, limit: 25, total: 0, totalPages: 1 };

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ore-500 dark:text-ore-300">Mesa de servicio · bandeja operativa</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-50 lg:text-4xl">Tickets</h1>
          <p className="mt-1 text-sm text-stone-400">{current.total} tickets en esta vista · ordenados para facilitar la atención.</p>
        </div>
        <Button asChild>
          <Link to="/tickets/new"><Plus className="h-4 w-4" /> Crear ticket</Link>
        </Button>
      </div>

      {/* Queue tabs */}
      <Tabs value={searchParams.get('scope') || ''} onValueChange={(value) => updateParam('scope', value)}>
        <TabsList>
          {queueOptions.map((queue) => (
            <TabsTrigger key={queue.value} value={queue.value}>{queue.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Asset filter banner */}
      {assetUidFilter && (
        <Card className="flex items-center gap-2 p-3">
          <span className="text-sm">Filtrando por activo relacionado: <code className="rounded bg-stone-100 px-1.5 py-0.5 text-xs font-mono dark:bg-stone-700">{assetUidFilter}</code></span>
          <Button variant="ghost" size="sm" onClick={() => updateParam('asset_uid', '')}><X className="mr-1 h-3 w-3" /> Quitar filtro</Button>
        </Card>
      )}

      {/* Filters */}
      <Card className="p-4">
        <form className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(260px,1.6fr)_repeat(4,minmax(135px,.7fr))_auto]" onSubmit={submit}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
            <Input aria-label="Buscar tickets" placeholder="Folio, título, solicitante, ubicación o equipo" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} className="pl-9" />
          </div>
          <SelectNative aria-label="Filtrar por estado" value={searchParams.get('status') || ''} onChange={(event) => updateParam('status', event.target.value)}>
            <option value="">Todos los estados</option>
            {statuses.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
          </SelectNative>
          <SelectNative aria-label="Filtrar por prioridad" value={searchParams.get('priority') || ''} onChange={(event) => updateParam('priority', event.target.value)}>
            <option value="">Todas las prioridades</option>
            {['P1', 'P2', 'P3', 'P4'].map((code) => <option key={code} value={code}>{code}</option>)}
          </SelectNative>
          <SelectNative aria-label="Filtrar por área" value={searchParams.get('business_area_id') || ''} onChange={(event) => updateParam('business_area_id', event.target.value)}>
            <option value="">Todas las áreas</option>
            {areas.map((area) => <option key={area.id} value={String(area.id)}>{area.name}</option>)}
          </SelectNative>
          <SelectNative aria-label="Ordenar tickets" value={searchParams.get('sort') || 'updated'} onChange={(event) => updateParam('sort', event.target.value)}>
            <option value="updated">Actualizados recientemente</option>
            <option value="newest">Más nuevos</option>
            <option value="oldest">Más antiguos</option>
            <option value="priority">Prioridad crítica primero</option>
            <option value="sla">Vencimiento SLA</option>
          </SelectNative>
          <Button variant="secondary" type="submit">Buscar</Button>
          {activeFilters > 0 && (
            <button className="col-span-full justify-self-start text-xs font-bold text-ore-600 hover:underline dark:text-ore-300 cursor-pointer" type="button" onClick={clearFilters}>Limpiar {activeFilters} filtros</button>
          )}
        </form>
      </Card>

      {/* Table */}
      {isLoading && !pageData ? (
        <Card className="space-y-3 p-5">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </Card>
      ) : error ? (
        <Card className="p-5"><p className="text-sm text-mrt-bad dark:text-mrt-bad-light">No se pudieron cargar los tickets</p></Card>
      ) : (
        <DataTable
          columns={tableColumns}
          data={current.items}
          sorting={sorting}
          onSortingChange={handleSortingChange}
          manualSorting
          columnFilters={columnFilters}
          onColumnFiltersChange={handleColumnFiltersChange}
          manualFiltering
          manualPagination
          pageCount={current.totalPages}
          page={current.page}
          totalRows={current.total}
          onPageChange={(p) => updateParam('page', String(p), false)}
          emptyTitle="No hay tickets en esta cola"
          emptyDescription="Prueba otra vista o elimina algunos filtros."
          minWidth="980px"
          onExportCsv={handleExportCsv}
          enableRowSelection
          getRowId={(ticket) => String(ticket.id)}
          tableId="tickets"
        />
      )}
    </div>
  );
}

export default Tickets;
