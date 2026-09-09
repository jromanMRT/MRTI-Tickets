import { FormEvent, useEffect, useState } from 'react';
import api from '../services/api';

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

function emptyForm() {
  return { name: '', priority_code: 'P3', first_response_minutes: 60, resolution_minutes: 480, business_area_id: '', category_id: '' };
}

function SlaPolicies() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [areas, setAreas] = useState<BusinessArea[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function load() {
    api.get('/sla/policies').then((res) => setPolicies(res.data.data)).catch((err) => setError(err.response?.data?.error?.message || 'No se pudieron cargar las políticas de SLA'));
  }

  useEffect(() => {
    load();
    api.get('/business-areas').then((res) => setAreas(res.data.data)).catch(() => setAreas([]));
    api.get('/categories').then((res) => setCategories(res.data.data)).catch(() => setCategories([]));
  }, []);

  const categoryOptions = form.business_area_id ? categories.filter((c) => String(c.business_area_id) === String(form.business_area_id)) : [];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/sla/policies', {
        name: form.name,
        priority_code: form.priority_code,
        first_response_minutes: Number(form.first_response_minutes),
        resolution_minutes: Number(form.resolution_minutes),
        business_area_id: form.business_area_id || null,
        category_id: form.category_id || null,
      });
      setForm(emptyForm());
      load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'No se pudo crear la política');
    } finally {
      setSaving(false);
    }
  }

  async function updateMinutes(policy: Policy, field: 'first_response_minutes' | 'resolution_minutes', value: string) {
    const minutes = Number(value);
    if (!Number.isFinite(minutes) || minutes < 0) return;
    try {
      await api.patch(`/sla/policies/${policy.id}`, { [field]: minutes });
      load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'No se pudo actualizar la política');
    }
  }

  async function remove(policy: Policy) {
    if (!window.confirm(`¿Eliminar la política "${policy.name}"? Los tickets ya creados conservan su SLA.`)) return;
    try {
      await api.delete(`/sla/policies/${policy.id}`);
      load();
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'No se pudo eliminar la política');
    }
  }

  return (
    <div className="page-stack">
      <div className="page-header enterprise-header">
        <div><p className="eyebrow">Configuración</p><h1>Políticas de SLA</h1><p className="subtitle">Por prioridad, y opcionalmente por área o categoría — la más específica gana al crear un ticket.</p></div>
      </div>

      {error && <p className="error loading-row">{error}</p>}

      <form onSubmit={submit} className="panel filters enterprise-filters" style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', alignItems: 'end' }}>
        <label>Nombre<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ej. SLA VPN crítica" /></label>
        <label>Prioridad
          <select value={form.priority_code} onChange={(e) => setForm({ ...form, priority_code: e.target.value })}>
            {PRIORITIES.map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
        <label>Área (opcional)
          <select value={form.business_area_id} onChange={(e) => setForm({ ...form, business_area_id: e.target.value, category_id: '' })}>
            <option value="">Cualquier área</option>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </label>
        <label>Categoría (opcional)
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} disabled={!form.business_area_id}>
            <option value="">Cualquier categoría del área</option>
            {categoryOptions.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label>Primera respuesta (min)<input type="number" min={0} required value={form.first_response_minutes} onChange={(e) => setForm({ ...form, first_response_minutes: Number(e.target.value) })} /></label>
        <label>Resolución (min)<input type="number" min={1} required value={form.resolution_minutes} onChange={(e) => setForm({ ...form, resolution_minutes: Number(e.target.value) })} /></label>
        <button className="button secondary" type="submit" disabled={saving}>{saving ? 'Guardando…' : '+ Agregar política'}</button>
      </form>

      <div className="panel table-wrap enterprise-table-wrap">
        <table className="table enterprise-table">
          <thead><tr><th>Prioridad</th><th>Alcance</th><th>Nombre</th><th>Primera respuesta</th><th>Resolución</th><th></th></tr></thead>
          <tbody>
            {policies.map((policy) => (
              <tr key={policy.id}>
                <td><span className={`priority priority-${policy.priority_code.toLowerCase()}`}>{policy.priority_code}</span></td>
                <td>
                  {policy.category_name ? `${policy.business_area_name} · ${policy.category_name}`
                    : policy.business_area_name ? policy.business_area_name
                    : <span className="unassigned-label">Cualquier área/categoría</span>}
                </td>
                <td>{policy.name}</td>
                <td><input type="number" min={0} defaultValue={policy.first_response_minutes} onBlur={(e) => updateMinutes(policy, 'first_response_minutes', e.target.value)} style={{ width: '5rem' }} /> <small className="table-subline">{minutesLabel(policy.first_response_minutes)}</small></td>
                <td><input type="number" min={1} defaultValue={policy.resolution_minutes} onBlur={(e) => updateMinutes(policy, 'resolution_minutes', e.target.value)} style={{ width: '5rem' }} /> <small className="table-subline">{minutesLabel(policy.resolution_minutes)}</small></td>
                <td>{(policy.business_area_id || policy.category_id) && <button type="button" onClick={() => remove(policy)} className="filter-clear">Eliminar</button>}</td>
              </tr>
            ))}
            {!policies.length && <tr><td colSpan={6} className="loading-row">Sin políticas configuradas.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SlaPolicies;
