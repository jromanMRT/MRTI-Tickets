import { type ColumnDef } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import api from '../services/api';
import { slaKeys, catalogKeys } from '@/lib/query-keys';
import { slaPolicySchema, type SlaPolicyFormData } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { SelectNative } from '@/components/ui/select-native';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/form-field';
import { DataTable } from '@/components/ui/data-table';
import { exportCsv } from '@/lib/export-csv';

interface Policy {
  id: number; name: string; priority_code: string; first_response_minutes: number; resolution_minutes: number;
  include_holidays: boolean; business_area_id: number | null; business_area_name: string | null;
  category_id: number | null; category_name: string | null;
}
interface BusinessArea { id: number; name: string }
interface Category { id: number; name: string; business_area_id: number | null }

const PRIORITIES = ['P1', 'P2', 'P3', 'P4'];

function minutesLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return `${hours} h${rest ? ` ${rest} min` : ''}`;
}

const priorityVariantMap: Record<string, 'priority-p1' | 'priority-p2' | 'priority-p3' | 'priority-p4'> = {
  p1: 'priority-p1', p2: 'priority-p2', p3: 'priority-p3', p4: 'priority-p4',
};

function SlaPolicies() {
  const qc = useQueryClient();
  const [error, setError] = useState('');

  const slaForm = useForm<SlaPolicyFormData>({
    resolver: zodResolver(slaPolicySchema),
    defaultValues: { name: '', priority_code: 'P3', first_response_minutes: 60, resolution_minutes: 480, business_area_id: '', category_id: '' },
  });
  const formAreaId = slaForm.watch('business_area_id');

  const { data: policies = [] } = useQuery({
    queryKey: slaKeys.list(),
    queryFn: () => api.get('/sla/policies').then((res) => res.data.data as Policy[]),
  });

  const { data: areas = [] } = useQuery({
    queryKey: catalogKeys.businessAreas(),
    queryFn: () => api.get('/business-areas').then((res) => res.data.data as BusinessArea[]),
    staleTime: 300_000,
  });

  const { data: categories = [] } = useQuery({
    queryKey: catalogKeys.categories(),
    queryFn: () => api.get('/categories').then((res) => res.data.data as Category[]),
    staleTime: 300_000,
  });

  const categoryOptions = formAreaId ? categories.filter((c) => String(c.business_area_id) === String(formAreaId)) : [];

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/sla/policies', payload),
    onSuccess: () => {
      slaForm.reset();
      setError('');
      void qc.invalidateQueries({ queryKey: slaKeys.list() });
      toast.success('Política creada');
    },
    onError: (err: any) => { const msg = err.response?.data?.error?.message || 'No se pudo crear la política'; setError(msg); toast.error(msg); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Record<string, unknown> }) => api.patch(`/sla/policies/${id}`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: slaKeys.list() });
      toast.success('Política actualizada');
    },
    onError: (err: any) => { const msg = err.response?.data?.error?.message || 'No se pudo actualizar la política'; setError(msg); toast.error(msg); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/sla/policies/${id}`),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: slaKeys.list() });
      toast.success('Política eliminada');
    },
    onError: (err: any) => { const msg = err.response?.data?.error?.message || 'No se pudo eliminar la política'; setError(msg); toast.error(msg); },
  });

  function onSlaSubmit(data: SlaPolicyFormData) {
    setError('');
    createMutation.mutate({
      name: data.name,
      priority_code: data.priority_code,
      first_response_minutes: data.first_response_minutes,
      resolution_minutes: data.resolution_minutes,
      business_area_id: data.business_area_id || null,
      category_id: data.category_id || null,
    });
  }

  function updateMinutes(policy: Policy, field: 'first_response_minutes' | 'resolution_minutes', value: string) {
    const minutes = Number(value);
    if (!Number.isFinite(minutes) || minutes < 0) return;
    updateMutation.mutate({ id: policy.id, data: { [field]: minutes } });
  }

  function remove(policy: Policy) {
    if (!window.confirm(`¿Eliminar la política "${policy.name}"? Los tickets ya creados conservan su SLA.`)) return;
    deleteMutation.mutate(policy.id);
  }

  const slaColumns = useMemo<ColumnDef<Policy>[]>(() => [
    {
      accessorKey: 'priority_code',
      header: 'Prioridad',
      enableColumnFilter: true,
      meta: { filterVariant: 'select', filterOptions: PRIORITIES.map((value) => ({ value, label: value })) },
      cell: ({ row }) => <Badge variant={priorityVariantMap[row.original.priority_code.toLowerCase()] || 'default'}>{row.original.priority_code}</Badge>,
    },
    {
      id: 'scope',
      header: 'Alcance',
      accessorFn: (row) => row.category_name || row.business_area_name || '',
      cell: ({ row }) => {
        const p = row.original;
        return (
          <span className="text-sm text-stone-600 dark:text-stone-300">
            {p.category_name ? `${p.business_area_name} · ${p.category_name}`
              : p.business_area_name ? p.business_area_name
              : <span className="font-bold text-mrt-warn dark:text-mrt-warn-light">Cualquier área/categoría</span>}
          </span>
        );
      },
    },
    {
      accessorKey: 'name',
      header: 'Nombre',
      enableColumnFilter: true,
      meta: { filterVariant: 'text', filterPlaceholder: 'Nombre' },
      cell: ({ row }) => <span className="text-sm font-bold text-stone-800 dark:text-stone-100">{row.original.name}</span>,
    },
    {
      accessorKey: 'first_response_minutes',
      header: 'Primera respuesta',
      enableColumnFilter: false,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center gap-2">
            <Input type="number" min={0} defaultValue={p.first_response_minutes} onBlur={(e) => updateMinutes(p, 'first_response_minutes', e.target.value)} className="inline-block w-20" />
            <small className="text-xs text-stone-400">{minutesLabel(p.first_response_minutes)}</small>
          </div>
        );
      },
    },
    {
      accessorKey: 'resolution_minutes',
      header: 'Resolución',
      enableColumnFilter: false,
      cell: ({ row }) => {
        const p = row.original;
        return (
          <div className="flex items-center gap-2">
            <Input type="number" min={1} defaultValue={p.resolution_minutes} onBlur={(e) => updateMinutes(p, 'resolution_minutes', e.target.value)} className="inline-block w-20" />
            <small className="text-xs text-stone-400">{minutesLabel(p.resolution_minutes)}</small>
          </div>
        );
      },
    },
    {
      id: 'actions',
      header: '',
      enableSorting: false,
      cell: ({ row }) => {
        const p = row.original;
        return (p.business_area_id || p.category_id) ? (
          <Button variant="ghost" size="sm" onClick={() => remove(p)}><Trash2 className="mr-1 h-3 w-3" /> Eliminar</Button>
        ) : null;
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], []);

  function handleExportCsv() {
    const headers = ['Prioridad', 'Área', 'Categoría', 'Nombre', 'Primera respuesta (min)', 'Resolución (min)'];
    const rows = policies.map((p) => [
      p.priority_code, p.business_area_name || 'Cualquiera', p.category_name || 'Cualquiera',
      p.name, String(p.first_response_minutes), String(p.resolution_minutes),
    ]);
    exportCsv(`sla-policies-${new Date().toISOString().slice(0, 10)}.csv`, headers, rows);
  }

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ore-500 dark:text-ore-300">Configuración</p>
        <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-50">Políticas de SLA</h1>
        <p className="mt-1 text-sm text-stone-400">Por prioridad, y opcionalmente por área o categoría — la más específica gana al crear un ticket.</p>
      </div>

      {error && <p className="text-sm text-mrt-bad dark:text-mrt-bad-light">{error}</p>}

      {/* Creation form */}
      <Card className="p-5">
        <form onSubmit={slaForm.handleSubmit(onSlaSubmit)} className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Nombre<Input {...slaForm.register('name')} placeholder="Ej. SLA VPN crítica" /></Label>
            <FieldError error={slaForm.formState.errors.name} />
          </div>
          <Label>Prioridad
            <SelectNative {...slaForm.register('priority_code')}>
              {PRIORITIES.map((code) => <option key={code} value={code}>{code}</option>)}
            </SelectNative>
          </Label>
          <Label>Área (opcional)
            <SelectNative {...slaForm.register('business_area_id', { onChange: () => slaForm.setValue('category_id', '') })}>
              <option value="">Cualquier área</option>
              {areas.map((a) => <option key={a.id} value={String(a.id)}>{a.name}</option>)}
            </SelectNative>
          </Label>
          <Label>Categoría (opcional)
            <SelectNative {...slaForm.register('category_id')} disabled={!formAreaId}>
              <option value="">Cualquier categoría del área</option>
              {categoryOptions.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </SelectNative>
          </Label>
          <div>
            <Label>Primera respuesta (min)<Input type="number" min={0} {...slaForm.register('first_response_minutes', { valueAsNumber: true })} /></Label>
            <FieldError error={slaForm.formState.errors.first_response_minutes} />
          </div>
          <div>
            <Label>Resolución (min)<Input type="number" min={1} {...slaForm.register('resolution_minutes', { valueAsNumber: true })} /></Label>
            <FieldError error={slaForm.formState.errors.resolution_minutes} />
          </div>
          <Button variant="secondary" type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? 'Guardando…' : '+ Agregar política'}</Button>
        </form>
      </Card>

      {/* Policies table */}
      <DataTable
        columns={slaColumns}
        data={policies}
        emptyTitle="Sin políticas configuradas"
        emptyDescription="Agrega una política con el formulario de arriba."
        minWidth="900px"
        onExportCsv={handleExportCsv}
        enableRowSelection
        getRowId={(policy) => String(policy.id)}
        tableId="sla-policies"
      />
    </div>
  );
}

export default SlaPolicies;
