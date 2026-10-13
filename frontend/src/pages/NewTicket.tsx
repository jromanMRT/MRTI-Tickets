import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MapPin, Monitor, Info, BookOpen } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import api from '../services/api';
import { ticketKeys, catalogKeys, kbKeys } from '@/lib/query-keys';
import { ticketSchema, type TicketFormData } from '@/lib/schemas';
import TicketEquipmentPicker, { EquipmentOption } from './TicketEquipmentPicker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SelectNative } from '@/components/ui/select-native';
import { Label } from '@/components/ui/label';
import { FieldError } from '@/components/ui/form-field';

interface KbSuggestion { id: number; title: string; snippet: string }

interface BusinessArea { id: number; name: string; code: string }
interface Category { id: number; name: string; business_area_id: number | null; business_area_name?: string }
interface Subcategory { id: number; category_id: number; name: string }
interface Priority { code: string; name: string }
interface ContextDevice { id: string; internal_id: string; name: string; inventory_tag?: string; is_primary_user_device: boolean }
interface TicketContext {
  requester_number?: number;
  location: null | { site_name: string; building_name: string; floor_name: string; area_name: string };
  primary_device: ContextDevice | null;
  area_devices: ContextDevice[];
  can_select_any_equipment?: boolean;
  equipment_options?: EquipmentOption[];
}

export default function NewTicket() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [error, setError] = useState('');
  const [equipmentKey, setEquipmentKey] = useState('');

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: { title: '', description: '', business_area_id: '', category_id: '', subcategory_id: '', priority_code: 'P3', affected_device_id: '' },
  });

  const areaId = watch('business_area_id');
  const categoryId = watch('category_id');
  const subcategoryId = watch('subcategory_id');
  const titleValue = watch('title');

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

  const { data: subcategories = [] } = useQuery({
    queryKey: catalogKeys.subcategories(),
    queryFn: () => api.get('/subcategories').then((res) => res.data.data as Subcategory[]),
    staleTime: 300_000,
  });

  const { data: priorities = [] } = useQuery({
    queryKey: catalogKeys.priorities(),
    queryFn: () => api.get('/priorities').then((res) => res.data.data as Priority[]),
    staleTime: 300_000,
  });

  const { data: context } = useQuery({
    queryKey: ticketKeys.context(),
    queryFn: () => api.get('/tickets/context').then((res) => res.data.data as TicketContext),
    staleTime: 120_000,
  });

  useEffect(() => {
    if (context) {
      setValue('affected_device_id', context.primary_device?.id || '');
      setEquipmentKey(context.equipment_options?.find((item) => item.device_id && item.device_id === context.primary_device?.id)?.key || '');
    }
  }, [context, setValue]);

  const suggestionsParams = (() => {
    const p = new URLSearchParams();
    if (categoryId) p.set('category_id', categoryId);
    if (subcategoryId) p.set('subcategory_id', subcategoryId);
    const q = (titleValue || '').trim();
    if (q.length >= 3) p.set('q', q);
    return p.toString();
  })();

  const { data: kbSuggestions = [] } = useQuery({
    queryKey: kbKeys.suggestions(suggestionsParams),
    queryFn: () => api.get(`/kb-articles/suggestions?${suggestionsParams}`).then((res) => res.data.data as KbSuggestion[]),
    enabled: !!(categoryId || (titleValue || '').trim().length >= 3),
    staleTime: 10_000,
  });

  const createMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.post('/tickets', payload),
    onSuccess: (res) => {
      void qc.invalidateQueries({ queryKey: ticketKeys.lists() });
      toast.success('Ticket creado');
      navigate(`/tickets/${res.data.data.id}`);
    },
    onError: (err: any) => { const msg = err.response?.data?.error?.message || 'No se pudo crear el ticket'; setError(msg); toast.error(msg); },
  });

  function categoriesForArea(id: string) {
    return categories.filter((item) => String(item.business_area_id ?? '') === id);
  }
  function subcategoriesForCategory(id: string) {
    return subcategories.filter((item) => String(item.category_id) === id);
  }

  function onValid(data: TicketFormData) {
    setError('');
    createMutation.mutate({
      title: data.title,
      description: data.description || '',
      business_area_id: Number(data.business_area_id),
      category_id: Number(data.category_id),
      subcategory_id: data.subcategory_id ? Number(data.subcategory_id) : null,
      priority_code: data.priority_code,
      affected_device_id: data.affected_device_id || undefined,
    });
  }

  return (
    <div className="mx-auto grid max-w-[920px] gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ore-500 dark:text-ore-300">Nuevo ticket</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-50">Crear ticket</h1>
        </div>
        <Button variant="ghost" asChild><Link to="/tickets">Cancelar</Link></Button>
      </div>

      <Card className="p-6">
        <form className="grid grid-cols-1 gap-5 sm:grid-cols-2" onSubmit={handleSubmit(onValid)}>
          {/* Context */}
          {context?.location ? (
            <div className="col-span-full grid grid-cols-1 gap-3 rounded-xl border border-mrt-info/20 bg-mrt-info/5 p-4 sm:grid-cols-2 dark:bg-mrt-info/10">
              <div className="grid gap-1">
                <small className="text-[0.68rem] font-bold uppercase text-stone-400"><MapPin className="mb-0.5 inline h-3 w-3" /> Ubicación detectada</small>
                <strong className="text-sm text-stone-800 dark:text-stone-100">{context.location.site_name} · {context.location.building_name} · {context.location.floor_name} · {context.location.area_name}</strong>
              </div>
              <div className="grid gap-1">
                <small className="text-[0.68rem] font-bold uppercase text-stone-400"><Monitor className="mb-0.5 inline h-3 w-3" /> Equipo habitual</small>
                <strong className="text-sm text-stone-800 dark:text-stone-100">{context.primary_device ? `${context.primary_device.internal_id} · ${context.primary_device.name}` : 'Sin equipo habitual asignado'}</strong>
              </div>
            </div>
          ) : context ? (
            <div className="col-span-full flex items-center gap-2 rounded-lg border border-mrt-warn/25 bg-mrt-warn/5 p-3 text-sm text-mrt-warn dark:bg-mrt-warn/10 dark:text-mrt-warn-light">
              <Info className="h-4 w-4 shrink-0" /> Tu cuenta todavía no tiene ubicación física asignada. El ticket se puede crear, pero no incluirá contexto automático.
            </div>
          ) : null}

          <div className="col-span-full">
            <Label>Título
              <Input {...register('title')} maxLength={255} placeholder="Describe brevemente el problema" />
            </Label>
            <FieldError error={errors.title} />
          </div>
          <Label className="col-span-full">Descripción
            <Textarea {...register('description')} rows={7} placeholder="Incluye síntomas, ubicación y cualquier dato útil" />
          </Label>

          {/* Category picker */}
          <div className="col-span-full grid gap-3">
            <small className="text-[0.78rem] font-bold text-stone-500 dark:text-stone-400">Destino del ticket</small>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <Label>Área
                  <SelectNative {...register('business_area_id', { onChange: () => { setValue('category_id', ''); setValue('subcategory_id', ''); } })}>
                    <option value="">Seleccionar área</option>
                    {areas.map((area) => <option key={area.id} value={String(area.id)}>{area.name}</option>)}
                  </SelectNative>
                </Label>
                <FieldError error={errors.business_area_id} />
              </div>
              <div>
                <Label>Categoría
                  <SelectNative {...register('category_id', { onChange: () => { setValue('subcategory_id', ''); } })} disabled={!areaId}>
                    <option value="">Seleccionar categoría</option>
                    {categoriesForArea(areaId).map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
                  </SelectNative>
                </Label>
                <FieldError error={errors.category_id} />
              </div>
              <Label>Detalle
                <SelectNative {...register('subcategory_id')} disabled={!subcategoriesForCategory(categoryId).length}>
                  <option value="">{subcategoriesForCategory(categoryId).length ? 'Seleccionar detalle' : 'Sin detalle adicional'}</option>
                  {subcategoriesForCategory(categoryId).map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
                </SelectNative>
              </Label>
            </div>
          </div>

          {/* KB suggestions */}
          {kbSuggestions.length > 0 && (
            <div className="col-span-full rounded-xl border border-mrt-info/20 bg-mrt-info/5 p-4 dark:bg-mrt-info/10">
              <small className="flex items-center gap-1.5 text-xs font-bold text-stone-500 dark:text-stone-400"><BookOpen className="h-3.5 w-3.5" /> Puede que esto ya resuelva tu problema</small>
              <ul className="mt-3 grid gap-2">
                {kbSuggestions.map((article) => (
                  <li key={article.id} className="grid gap-0.5">
                    <Link to={`/knowledge-base?open=${article.id}`} target="_blank" rel="noreferrer" className="text-sm font-bold text-ore-600 hover:underline dark:text-ore-300">{article.title}</Link>
                    <small className="text-xs text-stone-400">{article.snippet}…</small>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Label className="col-span-full">Prioridad
            <SelectNative {...register('priority_code')}>
              {priorities.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}
            </SelectNative>
          </Label>

          {context?.can_select_any_equipment ? (
            <div className="col-span-full">
              <TicketEquipmentPicker options={context.equipment_options || []} value={equipmentKey} onChange={setEquipmentKey} />
            </div>
          ) : (
            <Label className="col-span-full">Equipo afectado
              <SelectNative {...register('affected_device_id')} disabled={!context?.area_devices.length}>
                <option value="">Sin equipo específico</option>
                {context?.area_devices.map((device) => <option key={device.id} value={device.id}>{device.internal_id} · {device.name}{device.id === context.primary_device?.id ? ' · habitual' : ''}</option>)}
              </SelectNative>
              <small className="text-xs text-stone-400">Sólo aparecen equipos registrados en tu misma área física.</small>
            </Label>
          )}

          {error && <div className="col-span-full rounded-lg border border-mrt-bad/25 bg-mrt-bad/5 p-3 text-sm text-mrt-bad dark:text-mrt-bad-light">{error}</div>}

          <div className="col-span-full flex justify-end gap-3">
            <Button variant="ghost" asChild><Link to="/tickets">Cancelar</Link></Button>
            <Button disabled={createMutation.isPending}>{createMutation.isPending ? 'Guardando…' : 'Crear ticket'}</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
