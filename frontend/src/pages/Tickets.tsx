import { FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api';

interface TicketRow {
  id: number; folio: string; title: string; status_code: string; status_name: string;
  priority_code: string; priority_name: string; assigned_to_name?: string; requester_name?: string;
  created_at: string; updated_at: string; origin_area_name?: string; origin_site_name?: string;
  affected_device_internal_id?: string; affected_device_name?: string; business_area_name?: string;
  sla_state: 'completed' | 'none' | 'overdue' | 'at_risk' | 'on_track'; sla_deadline?: string;
  comment_count: number; attachment_count: number;
}
interface Option { code: string; name: string }
interface BusinessArea { id: number; name: string; code: string }
interface TicketPage { items: TicketRow[]; page: number; limit: number; total: number; totalPages: number }

const queueOptions = [
  { value: '', label: 'Todos' }, { value: 'open', label: 'Activos' }, { value: 'mine', label: 'Mis asignados' },
  { value: 'unassigned', label: 'Sin asignar' }, { value: 'overdue', label: 'SLA vencido' }, { value: 'at-risk', label: 'En riesgo' },
];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(value));
}

function slaLabel(state: TicketRow['sla_state']) {
  return ({ completed: 'Cumplido', none: 'Sin SLA', overdue: 'Vencido', at_risk: 'En riesgo', on_track: 'En tiempo' } as const)[state];
}

function Tickets() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryKey = searchParams.toString();
  const [pageData, setPageData] = useState<TicketPage>({ items: [], page: 1, limit: 25, total: 0, totalPages: 1 });
  const [statuses, setStatuses] = useState<Option[]>([]);
  const [areas, setAreas] = useState<BusinessArea[]>([]);
  const [draftQuery, setDraftQuery] = useState(searchParams.get('q') || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const activeFilters = ['status', 'priority', 'business_area_id', 'q', 'assigned_to'].filter((key) => searchParams.get(key)).length;

  useEffect(() => {
    let cancelled = false;
    setLoading(true); setError('');
    const params = Object.fromEntries(searchParams.entries());
    api.get('/tickets', { params }).then((response) => {
      if (!cancelled) setPageData(response.data.data);
    }).catch(() => { if (!cancelled) setError('No se pudieron cargar los tickets'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [queryKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    Promise.all([api.get('/statuses'), api.get('/business-areas')]).then(([statusRes, areaRes]) => {
      setStatuses(statusRes.data.data); setAreas(areaRes.data.data);
    }).catch(() => {});
  }, []);

  function updateParam(key: string, value: string, resetPage = true) {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (resetPage) next.delete('page');
    setSearchParams(next);
  }

  function submit(event: FormEvent) { event.preventDefault(); updateParam('q', draftQuery.trim()); }
  function clearFilters() { setDraftQuery(''); setSearchParams({}); }

  return (
    <div className="page-stack">
      <div className="page-header enterprise-header">
        <div><p className="eyebrow">Mesa de servicio · bandeja operativa</p><h1>Tickets</h1><p className="subtitle">{pageData.total} tickets en esta vista · ordenados para facilitar la atención.</p></div>
        <Link className="button" to="/tickets/new">Crear ticket</Link>
      </div>

      <div className="queue-tabs" role="tablist" aria-label="Colas de trabajo">
        {queueOptions.map((queue) => <button type="button" key={queue.value} className={`queue-tab ${searchParams.get('scope') === queue.value || (!searchParams.get('scope') && queue.value === '') ? 'active' : ''}`} onClick={() => updateParam('scope', queue.value)}>{queue.label}</button>)}
      </div>

      <form className="filters enterprise-filters panel" onSubmit={submit}>
        <div className="search-control"><span aria-hidden="true">⌕</span><input aria-label="Buscar tickets" placeholder="Folio, título, solicitante, ubicación o equipo" value={draftQuery} onChange={(event) => setDraftQuery(event.target.value)} /></div>
        <select aria-label="Filtrar por estado" value={searchParams.get('status') || ''} onChange={(event) => updateParam('status', event.target.value)}><option value="">Todos los estados</option>{statuses.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}</select>
        <select aria-label="Filtrar por prioridad" value={searchParams.get('priority') || ''} onChange={(event) => updateParam('priority', event.target.value)}><option value="">Todas las prioridades</option>{['P1', 'P2', 'P3', 'P4'].map((code) => <option key={code} value={code}>{code}</option>)}</select>
        <select aria-label="Filtrar por área" value={searchParams.get('business_area_id') || ''} onChange={(event) => updateParam('business_area_id', event.target.value)}><option value="">Todas las áreas</option>{areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select>
        <select aria-label="Ordenar tickets" value={searchParams.get('sort') || 'updated'} onChange={(event) => updateParam('sort', event.target.value)}><option value="updated">Actualizados recientemente</option><option value="newest">Más nuevos</option><option value="oldest">Más antiguos</option><option value="priority">Prioridad crítica primero</option><option value="sla">Vencimiento SLA</option></select>
        <button className="button secondary" type="submit">Buscar</button>
        {activeFilters > 0 && <button className="filter-clear" type="button" onClick={clearFilters}>Limpiar {activeFilters} filtros</button>}
      </form>

      <div className="panel table-wrap enterprise-table-wrap">
        <div className="table-toolbar"><span><strong>{pageData.total}</strong> resultados</span><small>Página {pageData.page} de {pageData.totalPages}</small></div>
        {loading ? <p className="muted loading-row">Cargando tickets…</p> : error ? <p className="error loading-row">{error}</p> : pageData.items.length === 0 ? (
          <div className="empty-state"><h2>No hay tickets en esta cola</h2><p>Prueba otra vista o elimina algunos filtros.</p>{activeFilters > 0 && <button className="button secondary" type="button" onClick={clearFilters}>Limpiar filtros</button>}</div>
        ) : (
          <table className="table enterprise-table">
            <thead><tr><th>Ticket</th><th>Área / solicitante</th><th>Estado</th><th>SLA</th><th>Responsable</th><th>Actividad</th></tr></thead>
            <tbody>{pageData.items.map((ticket) => (
              <tr key={ticket.id}>
                <td className="ticket-cell"><div><span className={`priority priority-${ticket.priority_code?.toLowerCase()}`}>{ticket.priority_code}</span><Link className="table-link" to={`/tickets/${ticket.id}`}>{ticket.folio}</Link></div><strong>{ticket.title}</strong><small>{ticket.origin_area_name || ticket.origin_site_name || 'Sin ubicación'}{ticket.affected_device_internal_id ? ` · ${ticket.affected_device_internal_id}` : ''}</small></td>
                <td>{ticket.business_area_name || 'Sin área'}<small className="table-subline">{ticket.requester_name || 'Sin solicitante'}</small></td>
                <td><span className={`status status-${ticket.status_code.toLowerCase()}`}>{ticket.status_name}</span></td>
                <td><span className={`sla-pill sla-${ticket.sla_state}`}>{slaLabel(ticket.sla_state)}</span>{ticket.sla_deadline && !['completed', 'none'].includes(ticket.sla_state) && <small className="table-subline">{formatDate(ticket.sla_deadline)}</small>}</td>
                <td>{ticket.assigned_to_name || <span className="unassigned-label">Sin asignar</span>}</td>
                <td><span className="activity-counts"><span title="Comentarios">◌ {ticket.comment_count}</span><span title="Adjuntos">⌕ {ticket.attachment_count}</span></span><small className="table-subline">{formatDate(ticket.updated_at)}</small></td>
              </tr>
            ))}</tbody>
          </table>
        )}
        {pageData.totalPages > 1 && <nav className="pagination" aria-label="Paginación"><button type="button" disabled={pageData.page <= 1} onClick={() => updateParam('page', String(pageData.page - 1), false)}>← Anterior</button><span>{pageData.page} / {pageData.totalPages}</span><button type="button" disabled={pageData.page >= pageData.totalPages} onClick={() => updateParam('page', String(pageData.page + 1), false)}>Siguiente →</button></nav>}
      </div>
    </div>
  );
}

export default Tickets;
