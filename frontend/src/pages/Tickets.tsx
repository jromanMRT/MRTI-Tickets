import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface TicketRow {
  id: number; folio: string; title: string; status_code: string; status_name: string;
  priority_code: string; priority_name: string; assigned_to_name?: string; created_at: string;
  origin_area_name?: string; origin_site_name?: string; affected_device_internal_id?: string; affected_device_name?: string;
}
interface Option { code: string; name: string }

function Tickets() {
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [statuses, setStatuses] = useState<Option[]>([]);
  const [filters, setFilters] = useState({ q: '', status: '', priority: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async (next = filters) => {
    setLoading(true); setError('');
    try {
      const params = Object.fromEntries(Object.entries(next).filter(([, value]) => value));
      const response = await api.get('/tickets', { params });
      setTickets(response.data.data.items || []);
    } catch { setError('No se pudieron cargar los tickets'); }
    finally { setLoading(false); }
  }, [filters]);

  useEffect(() => { void load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { api.get('/statuses').then((res) => setStatuses(res.data.data)).catch(() => {}); }, []);

  function submit(event: FormEvent) { event.preventDefault(); void load(filters); }

  return (
    <div className="page-stack">
      <div className="page-header">
        <div><p className="eyebrow">Solicitudes</p><h1>Tickets</h1></div>
        <Link className="button" to="/tickets/new">Crear ticket</Link>
      </div>
      <form className="filters panel" onSubmit={submit}>
        <input aria-label="Buscar tickets" placeholder="Buscar folio, título, área o equipo" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
        <select aria-label="Filtrar por estado" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
          <option value="">Todos los estados</option>{statuses.map((item) => <option key={item.code} value={item.code}>{item.name}</option>)}
        </select>
        <select aria-label="Filtrar por prioridad" value={filters.priority} onChange={(e) => setFilters({ ...filters, priority: e.target.value })}>
          <option value="">Todas las prioridades</option>{['P1', 'P2', 'P3', 'P4'].map((code) => <option key={code}>{code}</option>)}
        </select>
        <button className="button secondary" type="submit">Aplicar</button>
      </form>
      <div className="panel table-wrap">
        {loading ? <p className="muted">Cargando solicitudes…</p> : error ? <p className="error">{error}</p> : tickets.length === 0 ? (
          <div className="empty-state"><h2>No hay tickets</h2><p>Crea la primera solicitud o cambia los filtros.</p></div>
        ) : (
          <table className="table">
            <thead><tr><th>Folio</th><th>Solicitud</th><th>Ubicación</th><th>Equipo</th><th>Estado</th><th>Prioridad</th><th>Responsable</th><th>Creado</th></tr></thead>
            <tbody>{tickets.map((ticket) => (
              <tr key={ticket.id}>
                <td><Link className="table-link" to={`/tickets/${ticket.id}`}>{ticket.folio}</Link></td>
                <td>{ticket.title}</td>
                <td>{ticket.origin_area_name || 'Sin ubicación'}{ticket.origin_site_name && <small className="table-subline">{ticket.origin_site_name}</small>}</td>
                <td>{ticket.affected_device_internal_id || '—'}{ticket.affected_device_name && <small className="table-subline">{ticket.affected_device_name}</small>}</td>
                <td><span className={`status status-${ticket.status_code.toLowerCase()}`}>{ticket.status_name}</span></td>
                <td><span className={`priority priority-${ticket.priority_code?.toLowerCase()}`}>{ticket.priority_name || ticket.priority_code}</span></td>
                <td>{ticket.assigned_to_name || 'Sin asignar'}</td>
                <td>{new Date(ticket.created_at).toLocaleDateString()}</td>
              </tr>
            ))}</tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default Tickets;
