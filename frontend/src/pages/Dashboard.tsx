import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface CountGroup { code?: string; id?: number; name: string; count?: number; open?: number; overdue?: number; high_priority?: number }
interface RecentTicket { id: number; folio: string; title: string; status_code: string; status_name: string; priority_code: string; business_area_name: string; assigned_to_name?: string; sla_state: string; updated_at: string }
interface TrendPoint { day: string; count: number }
interface Summary {
  total: number; open: number; new: number; inProgress: number; waiting: number; resolved: number; closed: number;
  overdue: number; atRisk: number; unassigned: number; averageOpenAgeHours: number;
  byPriority: CountGroup[]; byArea: CountGroup[]; workload: CountGroup[]; recent: RecentTicket[];
  trend: { created: TrendPoint[]; resolved: TrendPoint[] };
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('es-MX', { day: '2-digit', month: 'short' }).format(new Date(value));
}

function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard/summary')
      .then((res) => setSummary(res.data.data))
      .catch(() => setError('No se pudo cargar el centro operativo'));
  }, []);

  const maxArea = useMemo(() => Math.max(...(summary?.byArea || []).map((item) => Number(item.open)), 1), [summary]);
  const maxWorkload = useMemo(() => Math.max(...(summary?.workload || []).map((item) => Number(item.open)), 1), [summary]);
  const trend = useMemo(() => {
    const created = new Map((summary?.trend.created || []).map((item) => [String(item.day).slice(0, 10), Number(item.count)]));
    const resolved = new Map((summary?.trend.resolved || []).map((item) => [String(item.day).slice(0, 10), Number(item.count)]));
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date();
      day.setHours(12, 0, 0, 0); day.setDate(day.getDate() - (6 - index));
      const key = day.toISOString().slice(0, 10);
      return { key, label: new Intl.DateTimeFormat('es-MX', { weekday: 'short' }).format(day).slice(0, 2), created: created.get(key) || 0, resolved: resolved.get(key) || 0 };
    });
  }, [summary]);
  const maxTrend = Math.max(...trend.flatMap((item) => [item.created, item.resolved]), 1);

  if (error) return <div className="panel error">{error}</div>;
  if (!summary) return <div className="panel muted">Cargando centro operativo…</div>;

  const queues = [
    { label: 'Mis asignados', value: 'mine', count: null, detail: 'Trabajo a mi cargo' },
    { label: 'Sin asignar', value: 'unassigned', count: summary.unassigned, detail: 'Requieren responsable' },
    { label: 'SLA vencido', value: 'overdue', count: summary.overdue, detail: 'Atención inmediata', tone: 'danger' },
    { label: 'SLA en riesgo', value: 'at-risk', count: summary.atRisk, detail: 'Consumieron 80% o más', tone: 'warning' },
  ];

  return (
    <div className="page-stack">
      <div className="page-header enterprise-header">
        <div><p className="eyebrow">Mesa de servicio · operación en vivo</p><h1>Centro operativo</h1><p className="subtitle">Prioriza la demanda, protege los SLA y distribuye la carga del equipo.</p></div>
        <div className="header-actions"><Link className="button secondary" to="/tickets?scope=open">Abrir bandeja</Link><Link className="button" to="/tickets/new">Crear ticket</Link></div>
      </div>

      <section className="executive-grid" aria-label="Indicadores principales">
        <Link className="executive-card primary" to="/tickets?scope=open"><span>Trabajo activo</span><strong>{summary.open}</strong><small>{summary.new} nuevos · {summary.inProgress} en proceso · {summary.waiting} en espera</small></Link>
        <Link className={`executive-card ${summary.overdue ? 'danger' : ''}`} to="/tickets?scope=overdue"><span>SLA vencido</span><strong>{summary.overdue}</strong><small>{summary.overdue ? 'Requiere recuperación inmediata' : 'Sin incumplimientos activos'}</small></Link>
        <Link className={`executive-card ${summary.atRisk ? 'warning' : ''}`} to="/tickets?scope=at-risk"><span>Próximos a vencer</span><strong>{summary.atRisk}</strong><small>80% o más del tiempo consumido</small></Link>
        <div className="executive-card"><span>Edad promedio abierta</span><strong>{summary.averageOpenAgeHours}<sup> h</sup></strong><small>{summary.resolved + summary.closed} tickets terminados</small></div>
      </section>

      <section>
        <div className="section-heading"><div><p className="eyebrow">Colas de trabajo</p><h2>Atención prioritaria</h2></div><Link to="/tickets">Ver todas →</Link></div>
        <div className="queue-grid">
          {queues.map((queue) => <Link key={queue.value} className={`queue-card ${queue.tone || ''}`} to={`/tickets?scope=${queue.value}`}><span>{queue.label}</span>{queue.count !== null && <strong>{queue.count}</strong>}<small>{queue.detail}</small><b aria-hidden="true">→</b></Link>)}
        </div>
      </section>

      <div className="operations-grid">
        <section className="panel operations-panel">
          <div className="section-heading compact"><div><p className="eyebrow">Demanda activa</p><h2>Por área de servicio</h2></div></div>
          {summary.byArea.length ? <div className="bar-list">{summary.byArea.map((area) => (
            <Link to={`/tickets?scope=open${area.id ? `&business_area_id=${area.id}` : ''}`} key={area.id || area.name} className="bar-row">
              <span><strong>{area.name}</strong><small>{Number(area.overdue) ? `${area.overdue} vencidos` : 'En cumplimiento'}</small></span>
              <i><b style={{ width: `${Math.max((Number(area.open) / maxArea) * 100, 4)}%` }} /></i><em>{area.open}</em>
            </Link>
          ))}</div> : <p className="muted">No hay demanda activa.</p>}
        </section>

        <section className="panel operations-panel">
          <div className="section-heading compact"><div><p className="eyebrow">Capacidad</p><h2>Carga por responsable</h2></div></div>
          {summary.workload.length ? <div className="bar-list">{summary.workload.map((person) => (
            <Link to={`/tickets?scope=open&assigned_to=${encodeURIComponent(String(person.id))}`} key={String(person.id)} className="bar-row">
              <span><strong>{person.name}</strong><small>{Number(person.high_priority) ? `${person.high_priority} de alta prioridad` : 'Carga normal'}</small></span>
              <i><b style={{ width: `${Math.max((Number(person.open) / maxWorkload) * 100, 4)}%` }} /></i><em>{person.open}</em>
            </Link>
          ))}</div> : <p className="muted">Aún no hay tickets asignados.</p>}
        </section>
      </div>

      <div className="operations-grid">
        <section className="panel operations-panel">
          <div className="section-heading compact"><div><p className="eyebrow">Severidad</p><h2>Activos por prioridad</h2></div><Link to="/tickets?scope=open&sort=priority">Priorizar →</Link></div>
          <div className="priority-summary">{['P1', 'P2', 'P3', 'P4'].map((code) => {
            const item = summary.byPriority.find((priority) => priority.code === code);
            return <Link to={`/tickets?scope=open&priority=${code}`} key={code}><span className={`priority priority-${code.toLowerCase()}`}>{code}</span><strong>{item?.count || 0}</strong><small>{item?.name || 'Sin casos'}</small></Link>;
          })}</div>
        </section>
        <section className="panel operations-panel">
          <div className="section-heading compact"><div><p className="eyebrow">Últimos 7 días</p><h2>Entrada y salida</h2></div><div className="chart-legend"><span>● Creados</span><span>● Resueltos</span></div></div>
          <div className="trend-chart" aria-label="Tickets creados y resueltos en los últimos siete días">{trend.map((item) => <div key={item.key}><span><i style={{ height: `${Math.max((item.created / maxTrend) * 100, item.created ? 8 : 0)}%` }} title={`${item.created} creados`} /><b style={{ height: `${Math.max((item.resolved / maxTrend) * 100, item.resolved ? 8 : 0)}%` }} title={`${item.resolved} resueltos`} /></span><small>{item.label}</small></div>)}</div>
        </section>
      </div>

      <section className="panel operations-panel">
        <div className="section-heading compact"><div><p className="eyebrow">Bandeja activa</p><h2>Siguiente trabajo recomendado</h2></div><Link to="/tickets?scope=open&sort=priority">Abrir cola →</Link></div>
        {summary.recent.length ? <div className="ticket-feed">{summary.recent.map((ticket) => (
          <Link to={`/tickets/${ticket.id}`} key={ticket.id} className="ticket-feed-row">
            <span className={`priority priority-${ticket.priority_code?.toLowerCase()}`}>{ticket.priority_code}</span>
            <span className="ticket-feed-main"><strong>{ticket.folio} · {ticket.title}</strong><small>{ticket.business_area_name} · {ticket.assigned_to_name || 'Sin asignar'} · Actualizado {shortDate(ticket.updated_at)}</small></span>
            <span className={`sla-pill sla-${ticket.sla_state}`}>{ticket.sla_state === 'overdue' ? 'SLA vencido' : ticket.sla_state === 'at_risk' ? 'En riesgo' : ticket.sla_state === 'on_track' ? 'En tiempo' : 'Sin SLA'}</span>
            <span className={`status status-${ticket.status_code.toLowerCase()}`}>{ticket.status_name}</span>
          </Link>
        ))}</div> : <div className="empty-state compact"><h2>La bandeja está al día</h2><p>No existen tickets activos pendientes.</p></div>}
      </section>
    </div>
  );
}

export default Dashboard;
