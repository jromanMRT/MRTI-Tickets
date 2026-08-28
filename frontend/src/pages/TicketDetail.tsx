import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api';

interface TicketCategoryLink { category_id: number; category_name: string; business_area_id?: number; business_area_name?: string; subcategory_id?: number; subcategory_name?: string }
interface Ticket {
  id: number; folio: string; title: string; description?: string; status_code: string; status_name: string;
  priority_code?: string; priority_name?: string; category_name?: string; categories?: TicketCategoryLink[]; requester_name?: string;
  requester_email?: string; requester_number?: number; assigned_to?: string; assigned_to_name?: string; asset_number?: string;
  related_device_id?: string; requester_device_internal_id?: string; requester_device_name?: string;
  affected_device_internal_id?: string; affected_device_name?: string; origin_site_name?: string;
  origin_building_name?: string; origin_floor_name?: string; origin_area_name?: string;
  business_area_id?: number; business_area_name?: string;
  created_at: string; updated_at: string;
}
interface Status { code: string; name: string }
interface Comment { id: number; author_name?: string; content: string; is_private: boolean; created_at: string }
interface Attachment { id: number; filename: string; mime_type: string; size_bytes: number; created_at: string }
interface HistoryItem { to_status_name: string; from_status_name?: string; comment?: string; created_at: string }
interface Assignee { id: string; full_name: string; role: string }
interface SlaStatus { elapsedMinutes: number; remainingMinutes: number | null; percentConsumed: number | null; state: 'En tiempo' | 'En riesgo' | 'Vencido' | 'Pausado' | 'Cumplido' | 'Sin SLA'; deadline: string | null }

function duration(minutes: number | null) {
  if (minutes === null) return 'No definido';
  const absolute = Math.abs(minutes);
  if (absolute < 60) return `${absolute} min`;
  const hours = Math.floor(absolute / 60);
  const remaining = absolute % 60;
  return `${hours} h${remaining ? ` ${remaining} min` : ''}`;
}

export default function TicketDetail() {
  const { id } = useParams();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [assignees, setAssignees] = useState<Assignee[]>([]);
  const [sla, setSla] = useState<SlaStatus | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [ticketRes, statusRes, commentRes, attachmentRes, historyRes, slaRes] = await Promise.all([
        api.get(`/tickets/${id}`), api.get('/statuses'), api.get(`/tickets/${id}/comments`),
        api.get(`/tickets/${id}/attachments`), api.get(`/tickets/${id}/history`), api.get(`/tickets/${id}/sla-status`),
      ]);
      const loadedTicket = ticketRes.data.data as Ticket;
      setTicket(loadedTicket); setStatuses(statusRes.data.data); setComments(commentRes.data.data);
      setAttachments(attachmentRes.data.data); setHistory(historyRes.data.data.status_history || []);
      setSla(slaRes.data.data);
      // El área se resuelve primero para que el selector de responsable
      // solo muestre al equipo de esa área (si ya tiene uno registrado).
      const assigneeRes = await api.get('/assignees', { params: loadedTicket.business_area_id ? { business_area_id: loadedTicket.business_area_id } : {} });
      setAssignees(assigneeRes.data.data || []);
      setError('');
    } catch (requestError: any) {
      setError(requestError.response?.data?.error?.message || 'No se pudo cargar el ticket');
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function changeStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy('status');
    const data = new FormData(event.currentTarget);
    try { await api.patch(`/tickets/${id}/status`, { to_status_code: data.get('status'), comment: data.get('comment') }); await load(); }
    catch (requestError: any) { setError(requestError.response?.data?.error?.message || 'No se pudo cambiar el estado'); }
    finally { setBusy(''); }
  }

  async function addComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy('comment');
    const form = event.currentTarget; const data = new FormData(form);
    try { await api.post(`/tickets/${id}/comments`, { content: data.get('content') }); form.reset(); await load(); }
    catch (requestError: any) { setError(requestError.response?.data?.error?.message || 'No se pudo agregar el comentario'); }
    finally { setBusy(''); }
  }

  async function assignToMe() {
    setBusy('assign');
    try { await api.post(`/tickets/${id}/assign`, { assigned_to: 'me', note: 'Asignación desde MRTI-Tickets' }); await load(); }
    catch (requestError: any) { setError(requestError.response?.data?.error?.message || 'No tienes permiso para asignar este ticket'); }
    finally { setBusy(''); }
  }

  async function assignPerson(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy('assign');
    const form = event.currentTarget; const data = new FormData(form);
    const assignee = assignees.find((item) => item.id === data.get('assignee'));
    if (!assignee) { setBusy(''); return; }
    try { await api.post(`/tickets/${id}/assign`, { assigned_to: assignee.id, assigned_to_name: assignee.full_name, note: 'Asignación desde MRTI-Tickets' }); await load(); }
    catch (requestError: any) { setError(requestError.response?.data?.error?.message || 'No tienes permiso para asignar este ticket'); }
    finally { setBusy(''); }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy('file');
    const form = event.currentTarget; const data = new FormData(form);
    try { await api.post(`/tickets/${id}/attachments`, data); form.reset(); await load(); }
    catch (requestError: any) { setError(requestError.response?.data?.error?.message || 'No se pudo adjuntar el archivo'); }
    finally { setBusy(''); }
  }

  async function download(file: Attachment) {
    const response = await api.get(`/tickets/${id}/attachments/${file.id}`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a'); link.href = url; link.download = file.filename; link.click();
    URL.revokeObjectURL(url);
  }

  if (error && !ticket) return <div className="panel error">{error} <Link to="/tickets">Volver</Link></div>;
  if (!ticket) return <div className="panel muted">Cargando ticket…</div>;

  return (
    <div className="page-stack">
      <div className="page-header">
        <div><Link className="back-link" to="/tickets">← Todos los tickets</Link><h1>{ticket.folio}</h1><p className="subtitle">{ticket.title}</p></div>
        <span className={`status status-${ticket.status_code.toLowerCase()}`}>{ticket.status_name}</span>
      </div>
      {error && <div className="form-error">{error}</div>}
      <div className="detail-grid">
        <div className="page-stack">
          <section className="panel"><h2>Descripción</h2><p className="description">{ticket.description || 'Sin descripción.'}</p></section>
          <section className="panel">
            <h2>Conversación <span className="count">{comments.length}</span></h2>
            <div className="comment-list">{comments.length ? comments.map((comment) => (
              <article className="comment" key={comment.id}><div><strong>{comment.author_name || 'Sistema'}</strong><time>{new Date(comment.created_at).toLocaleString()}</time></div><p>{comment.content}</p></article>
            )) : <p className="muted">Aún no hay comentarios.</p>}</div>
            <form className="comment-form" onSubmit={addComment}><textarea name="content" required rows={3} placeholder="Escribe una actualización…" /><button className="button" disabled={busy === 'comment'}>{busy === 'comment' ? 'Enviando…' : 'Agregar comentario'}</button></form>
          </section>
          <section className="panel">
            <h2>Archivos <span className="count">{attachments.length}</span></h2>
            <div className="file-list">{attachments.map((file) => <button key={file.id} onClick={() => void download(file)}><span>{file.filename}</span><small>{Math.ceil(file.size_bytes / 1024)} KB · Descargar</small></button>)}</div>
            <form className="upload-form" onSubmit={upload}><input name="file" type="file" required /><button className="button secondary" disabled={busy === 'file'}>{busy === 'file' ? 'Subiendo…' : 'Adjuntar'}</button></form>
          </section>
          <section className="panel"><h2>Historial</h2><div className="timeline">{history.map((item, index) => <div key={`${item.created_at}-${index}`}><span></span><p><strong>{item.to_status_name}</strong>{item.comment && <> · {item.comment}</>}<small>{new Date(item.created_at).toLocaleString()}</small></p></div>)}</div></section>
        </div>
        <aside className="page-stack">
          {sla && <section className={`panel sla-card sla-state-${sla.state.toLowerCase().replace(/\s+/g, '-')}`}>
            <div className="sla-card-heading"><div><p className="eyebrow">Acuerdo de servicio</p><h2>{sla.state}</h2></div><strong>{sla.percentConsumed === null ? '—' : `${sla.percentConsumed}%`}</strong></div>
            {sla.percentConsumed !== null && <div className="sla-progress" aria-label={`${sla.percentConsumed}% del SLA consumido`}><span style={{ width: `${Math.max(Math.min(sla.percentConsumed, 100), 2)}%` }} /></div>}
            <div className="sla-card-meta"><span><small>Tiempo transcurrido</small><strong>{duration(sla.elapsedMinutes)}</strong></span><span><small>{sla.remainingMinutes !== null && sla.remainingMinutes < 0 ? 'Vencido hace' : 'Tiempo restante'}</small><strong>{duration(sla.remainingMinutes)}</strong></span></div>
            {sla.deadline && <p>Compromiso: {new Date(sla.deadline).toLocaleString()}</p>}
          </section>}
          <section className="panel metadata"><h2>Información</h2>
            <dl><div><dt>Área</dt><dd>{ticket.business_area_name || 'Sin área'}</dd></div><div><dt>Prioridad</dt><dd>{ticket.priority_name || ticket.priority_code || 'Sin prioridad'}</dd></div><div><dt>Categorías</dt><dd>{ticket.categories?.length ? <span className="category-tag-list">{ticket.categories.map((item, index) => <span className="category-tag" key={`${item.category_id}-${item.subcategory_id ?? index}`}>{item.business_area_name ? `${item.business_area_name} · ` : ''}{item.category_name}{item.subcategory_name ? ` · ${item.subcategory_name}` : ''}</span>)}</span> : (ticket.category_name || 'Sin categoría')}</dd></div><div><dt>Origen</dt><dd>{ticket.requester_number ? `USR-${String(ticket.requester_number).padStart(6, '0')}` : 'Sin identificar'}</dd></div><div><dt>Ubicación</dt><dd>{ticket.origin_area_name || 'Sin ubicación'}<small>{[ticket.origin_site_name, ticket.origin_building_name, ticket.origin_floor_name].filter(Boolean).join(' · ')}</small></dd></div><div><dt>Equipo habitual</dt><dd>{ticket.requester_device_internal_id || '—'}<small>{ticket.requester_device_name}</small></dd></div><div><dt>Equipo afectado</dt><dd>{ticket.affected_device_internal_id || ticket.asset_number || '—'}<small>{ticket.affected_device_name}</small></dd></div><div><dt>Responsable</dt><dd>{ticket.assigned_to_name || 'Sin asignar'}</dd></div><div><dt>Creado</dt><dd>{new Date(ticket.created_at).toLocaleString()}</dd></div></dl>
            {assignees.length > 0 && <><button className="button secondary full-button" onClick={() => void assignToMe()} disabled={busy === 'assign'}>{busy === 'assign' ? 'Asignando…' : 'Asignarme este ticket'}</button><form className="assign-form" onSubmit={assignPerson}><select name="assignee" defaultValue={ticket.assigned_to || ''}><option value="" disabled>Seleccionar responsable</option>{assignees.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</select><button className="button ghost" disabled={busy === 'assign'}>Asignar a esta persona</button></form></>}
          </section>
          <form className="panel form-stack" onSubmit={changeStatus}><h2>Cambiar estado</h2><label>Nuevo estado<select name="status" defaultValue={ticket.status_code}>{statuses.map((status) => <option key={status.code} value={status.code}>{status.name}</option>)}</select></label><label>Nota<textarea name="comment" rows={3} placeholder="Motivo del cambio (opcional)" /></label><button className="button" disabled={busy === 'status'}>{busy === 'status' ? 'Guardando…' : 'Actualizar estado'}</button></form>
        </aside>
      </div>
    </div>
  );
}
