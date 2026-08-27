import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

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
}

export default function NewTicket() {
  const navigate = useNavigate();
  const [areas, setAreas] = useState<BusinessArea[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [areaId, setAreaId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [subcategoryId, setSubcategoryId] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [context, setContext] = useState<TicketContext | null>(null);
  const [affectedDeviceId, setAffectedDeviceId] = useState('');

  useEffect(() => {
    Promise.all([
      api.get('/business-areas'), api.get('/categories'), api.get('/subcategories'),
      api.get('/priorities'), api.get('/tickets/context'),
    ])
      .then(([areaResponse, categoryResponse, subcategoryResponse, priorityResponse, contextResponse]) => {
        setAreas(areaResponse.data.data); setCategories(categoryResponse.data.data);
        setSubcategories(subcategoryResponse.data.data); setPriorities(priorityResponse.data.data);
        const nextContext = contextResponse.data.data as TicketContext;
        setContext(nextContext);
        setAffectedDeviceId(nextContext.primary_device?.id || '');
      }).catch(() => setError('No se pudieron cargar los catálogos'));
  }, []);

  function categoriesForArea(areaId: string) {
    return categories.filter((item) => String(item.business_area_id ?? '') === areaId);
  }
  function subcategoriesForCategory(categoryId: string) {
    return subcategories.filter((item) => String(item.category_id) === categoryId);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError('');
    const data = new FormData(event.currentTarget);
    const payload = Object.fromEntries(data.entries()) as Record<string, unknown>;
    payload.business_area_id = Number(areaId);
    payload.category_id = Number(categoryId);
    payload.subcategory_id = subcategoryId ? Number(subcategoryId) : null;
    try {
      const response = await api.post('/tickets', payload);
      navigate(`/tickets/${response.data.data.id}`);
    } catch (requestError: any) {
      setError(requestError.response?.data?.error?.message || 'No se pudo crear el ticket');
    } finally { setSaving(false); }
  }

  return (
    <div className="page-stack narrow">
      <div className="page-header"><div><p className="eyebrow">Nueva solicitud</p><h1>Crear ticket</h1></div><Link to="/tickets">Cancelar</Link></div>
      <form className="panel form-grid" onSubmit={submit}>
        {context?.location ? <section className="ticket-context full">
          <div><small>Ubicación detectada</small><strong>{context.location.site_name} · {context.location.building_name} · {context.location.floor_name} · {context.location.area_name}</strong></div>
          <div><small>Equipo habitual</small><strong>{context.primary_device ? `${context.primary_device.internal_id} · ${context.primary_device.name}` : 'Sin equipo habitual asignado'}</strong></div>
        </section> : <div className="context-warning full">Tu cuenta todavía no tiene ubicación física asignada. El ticket se puede crear, pero no incluirá contexto automático.</div>}
        <label className="full">Título<input name="title" required maxLength={255} placeholder="Describe brevemente el problema" /></label>
        <label className="full">Descripción<textarea name="description" rows={7} placeholder="Incluye síntomas, ubicación y cualquier dato útil" /></label>
        <div className="full category-picker">
          <small className="category-picker-label">Destino de la solicitud</small>
          <div className="category-row">
            <label>Área<select required value={areaId} onChange={(event) => { setAreaId(event.target.value); setCategoryId(''); setSubcategoryId(''); }}><option value="">Seleccionar área</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
            <label>Categoría<select required value={categoryId} disabled={!areaId} onChange={(event) => { setCategoryId(event.target.value); setSubcategoryId(''); }}><option value="">Seleccionar categoría</option>{categoriesForArea(areaId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Detalle<select value={subcategoryId} disabled={!subcategoriesForCategory(categoryId).length} onChange={(event) => setSubcategoryId(event.target.value)}><option value="">{subcategoriesForCategory(categoryId).length ? 'Seleccionar detalle' : 'Sin detalle adicional'}</option>{subcategoriesForCategory(categoryId).map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          </div>
        </div>
        <label className="full">Prioridad<select name="priority_code" defaultValue="P3">{priorities.map((item) => <option key={item.code} value={item.code}>{item.code} · {item.name}</option>)}</select></label>
        <label className="full">Equipo afectado<select name="affected_device_id" value={affectedDeviceId} onChange={(event) => setAffectedDeviceId(event.target.value)} disabled={!context?.area_devices.length}><option value="">Sin equipo específico</option>{context?.area_devices.map((device) => <option key={device.id} value={device.id}>{device.internal_id} · {device.name}{device.id === context.primary_device?.id ? ' · habitual' : ''}</option>)}</select><small>Sólo aparecen equipos registrados en tu misma área física.</small></label>
        {error && <div className="form-error full">{error}</div>}
        <div className="form-actions full"><Link className="button ghost" to="/tickets">Cancelar</Link><button className="button" disabled={saving}>{saving ? 'Guardando…' : 'Crear ticket'}</button></div>
      </form>
    </div>
  );
}
