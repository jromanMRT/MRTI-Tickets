import { FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Download, Upload, MessageSquare, Paperclip, Clock, User, MapPin, Monitor, Tag, CalendarDays, Shield } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import api from '../services/api';
import { ticketKeys, catalogKeys } from '@/lib/query-keys';
import { commentSchema, statusChangeSchema, assignSchema, type CommentFormData, type StatusChangeFormData, type AssignFormData } from '@/lib/schemas';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { SelectNative } from '@/components/ui/select-native';
import { Label } from '@/components/ui/label';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { FieldError } from '@/components/ui/form-field';
import { cn } from '@/lib/utils';

interface TicketCategoryLink { category_id: number; category_name: string; business_area_id?: number; business_area_name?: string; subcategory_id?: number; subcategory_name?: string }
interface Ticket {
  id: number; folio: string; title: string; description?: string; status_code: string; status_name: string;
  priority_code?: string; priority_name?: string; category_name?: string; categories?: TicketCategoryLink[]; requester_name?: string;
  requester_email?: string; requester_number?: number; assigned_to?: string; assigned_to_name?: string; asset_number?: string;
  asset_uid?: string;
  related_device_id?: string; requester_device_internal_id?: string; requester_device_name?: string;
  affected_device_internal_id?: string; affected_device_name?: string; origin_site_name?: string;
  origin_building_name?: string; origin_floor_name?: string; origin_area_name?: string;
  business_area_id?: number; business_area_name?: string;
  created_at: string; updated_at: string;
}
interface Status { code: string; name: string }
interface Workflow { current_status_code: string; allowed_statuses: Status[]; requires_reason_for: string[] }
interface Comment { id: number; author_name?: string; content: string; is_private: boolean; created_at: string }
interface Attachment { id: number; filename: string; mime_type: string; size_bytes: number; created_at: string }
interface HistoryItem { to_status_name: string; from_status_name?: string; comment?: string; created_at: string }
interface Assignee { id: string; full_name: string; role: string }
interface RelatedAsset {
  id: number; asset_uid: string; center_code: string; descripcion?: string; tipo?: string;
  marca?: string; modelo?: string; service_tag?: string; numero_serie?: string; estado?: string;
  unidad?: string; empresa?: string; usuario_asignado?: string;
}
interface SlaStatus { elapsedMinutes: number; pausedMinutes: number; remainingMinutes: number | null; percentConsumed: number | null; state: 'En tiempo' | 'En riesgo' | 'Vencido' | 'Pausado' | 'Cumplido' | 'Sin SLA'; deadline: string | null }

function duration(minutes: number | null) {
  if (minutes === null) return 'No definido';
  const absolute = Math.abs(minutes);
  if (absolute < 60) return `${absolute} min`;
  const hours = Math.floor(absolute / 60);
  const remaining = absolute % 60;
  return `${hours} h${remaining ? ` ${remaining} min` : ''}`;
}

const statusVariant = (code: string) => {
  const lower = code.toLowerCase();
  if (lower === 'resolved' || lower === 'closed') return 'status-resolved' as const;
  if (lower === 'cancelled') return 'status-cancelled' as const;
  if (lower.startsWith('on_hold')) return 'status-hold' as const;
  return 'status' as const;
};

const slaColorClass = (state: string) => {
  const s = state.toLowerCase().replace(/\s+/g, '-');
  if (s === 'vencido') return 'border-mrt-bad/30';
  if (s === 'en-riesgo') return 'border-mrt-warn/30';
  if (s === 'pausado') return 'border-mrt-info/30';
  return '';
};

const slaBarClass = (state: string) => {
  const s = state.toLowerCase().replace(/\s+/g, '-');
  if (s === 'vencido') return 'from-mrt-bad/70 to-mrt-bad';
  if (s === 'en-riesgo') return 'from-mrt-warn/70 to-mrt-warn';
  if (s === 'pausado') return 'from-mrt-info/70 to-mrt-info';
  return 'from-mrt-good/70 to-mrt-good';
};

export default function TicketDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [error, setError] = useState('');

  const invalidateAll = () => {
    void qc.invalidateQueries({ queryKey: ticketKeys.detail(id!) });
    void qc.invalidateQueries({ queryKey: ticketKeys.workflow(id!) });
    void qc.invalidateQueries({ queryKey: ticketKeys.comments(id!) });
    void qc.invalidateQueries({ queryKey: ticketKeys.attachments(id!) });
    void qc.invalidateQueries({ queryKey: ticketKeys.history(id!) });
    void qc.invalidateQueries({ queryKey: ticketKeys.sla(id!) });
  };

  const { data: ticket } = useQuery({
    queryKey: ticketKeys.detail(id!),
    queryFn: () => api.get(`/tickets/${id}`).then((res) => res.data.data as Ticket),
    enabled: !!id,
  });

  const { data: workflow } = useQuery({
    queryKey: ticketKeys.workflow(id!),
    queryFn: () => api.get(`/tickets/${id}/workflow`).then((res) => res.data.data as Workflow),
    enabled: !!id,
  });

  const { data: comments = [] } = useQuery({
    queryKey: ticketKeys.comments(id!),
    queryFn: () => api.get(`/tickets/${id}/comments`).then((res) => res.data.data as Comment[]),
    enabled: !!id,
  });

  const { data: attachments = [] } = useQuery({
    queryKey: ticketKeys.attachments(id!),
    queryFn: () => api.get(`/tickets/${id}/attachments`).then((res) => res.data.data as Attachment[]),
    enabled: !!id,
  });

  const { data: history = [] } = useQuery({
    queryKey: ticketKeys.history(id!),
    queryFn: () => api.get(`/tickets/${id}/history`).then((res) => (res.data.data.status_history || []) as HistoryItem[]),
    enabled: !!id,
  });

  const { data: sla } = useQuery({
    queryKey: ticketKeys.sla(id!),
    queryFn: () => api.get(`/tickets/${id}/sla-status`).then((res) => res.data.data as SlaStatus),
    enabled: !!id,
  });

  const { data: assignees = [] } = useQuery({
    queryKey: catalogKeys.assignees(ticket?.business_area_id),
    queryFn: () => api.get('/assignees', { params: ticket?.business_area_id ? { business_area_id: ticket.business_area_id } : {} }).then((res) => (res.data.data || []) as Assignee[]),
    enabled: !!ticket,
  });

  const { data: relatedAsset, error: assetError } = useQuery({
    queryKey: ['related-asset', ticket?.asset_uid],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`/activos-api/api/activos-self/uid/${encodeURIComponent(ticket!.asset_uid!)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error(res.status === 404 ? 'El activo relacionado ya no existe' : 'No se pudo consultar el activo relacionado');
      const body = await res.json();
      return (body.data || null) as RelatedAsset | null;
    },
    enabled: !!ticket?.asset_uid,
  });

  const statusMutation = useMutation({
    mutationFn: (data: { to_status_code: string; comment: string }) => api.patch(`/tickets/${id}/status`, data),
    onSuccess: () => { invalidateAll(); setError(''); toast.success('Estado actualizado'); },
    onError: (err: any) => { const msg = err.response?.data?.error?.message || 'No se pudo cambiar el estado'; setError(msg); toast.error(msg); },
  });

  const commentMutation = useMutation({
    mutationFn: (data: { content: string; is_private: boolean }) => api.post(`/tickets/${id}/comments`, data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ticketKeys.comments(id!) });
      setError(''); toast.success('Comentario agregado');
    },
    onError: (err: any) => { const msg = err.response?.data?.error?.message || 'No se pudo agregar el comentario'; setError(msg); toast.error(msg); },
  });

  const assignMutation = useMutation({
    mutationFn: (data: { assigned_to: string; assigned_to_name?: string; note: string }) => api.post(`/tickets/${id}/assign`, data),
    onSuccess: () => { invalidateAll(); setError(''); toast.success('Ticket asignado'); },
    onError: (err: any) => { const msg = err.response?.data?.error?.message || 'No tienes permiso para asignar este ticket'; setError(msg); toast.error(msg); },
  });

  const uploadMutation = useMutation({
    mutationFn: (formData: FormData) => api.post(`/tickets/${id}/attachments`, formData),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ticketKeys.attachments(id!) });
      setError(''); toast.success('Archivo adjuntado');
    },
    onError: (err: any) => { const msg = err.response?.data?.error?.message || 'No se pudo adjuntar el archivo'; setError(msg); toast.error(msg); },
  });

  const commentForm = useForm<CommentFormData>({ resolver: zodResolver(commentSchema), defaultValues: { content: '', is_private: false } });
  const statusForm = useForm<StatusChangeFormData>({ resolver: zodResolver(statusChangeSchema), defaultValues: { status: '', comment: '' } });
  const assignForm = useForm<AssignFormData>({ resolver: zodResolver(assignSchema), defaultValues: { assignee: '' } });

  function onComment(data: CommentFormData) {
    commentMutation.mutate(data, { onSuccess: () => commentForm.reset() });
  }

  function onStatusChange(data: StatusChangeFormData) {
    statusMutation.mutate({ to_status_code: data.status, comment: data.comment || '' });
  }

  function assignToMe() {
    assignMutation.mutate({ assigned_to: 'me', note: 'Asignación desde MRTI Tickets' });
  }

  function onAssign(data: AssignFormData) {
    const person = assignees.find((item) => item.id === data.assignee);
    if (!person) return;
    assignMutation.mutate({ assigned_to: person.id, assigned_to_name: person.full_name, note: 'Asignación desde MRTI Tickets' });
  }

  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fd = new FormData(form);
    uploadMutation.mutate(fd, { onSuccess: () => form.reset() });
  }

  async function download(file: Attachment) {
    const response = await api.get(`/tickets/${id}/attachments/${file.id}`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement('a'); link.href = url; link.download = file.filename; link.click();
    URL.revokeObjectURL(url);
  }

  if (error && !ticket) return <Card className="text-mrt-bad dark:text-mrt-bad-light">{error} <Link to="/tickets" className="underline">Volver</Link></Card>;
  if (!ticket) return (
    <div className="grid gap-6">
      <Skeleton className="h-12 w-64" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,.8fr)]">
        <div className="space-y-6"><Skeleton className="h-48" /><Skeleton className="h-64" /></div>
        <div className="space-y-6"><Skeleton className="h-48" /><Skeleton className="h-48" /></div>
      </div>
    </div>
  );

  const requesterInitials = (ticket.requester_name || 'SI').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  const possibleStatuses = workflow?.allowed_statuses || [];
  const busy = statusMutation.isPending ? 'status' : commentMutation.isPending ? 'comment' : assignMutation.isPending ? 'assign' : uploadMutation.isPending ? 'file' : '';

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link className="mb-2 inline-flex items-center gap-1 text-sm font-semibold text-stone-500 hover:text-stone-800 dark:hover:text-stone-200" to="/tickets"><ArrowLeft className="h-3.5 w-3.5" /> Todos los tickets</Link>
          <h1 className="text-3xl font-extrabold tracking-tight text-stone-900 dark:text-stone-50">{ticket.folio}</h1>
          <p className="mt-1 text-sm text-stone-400">{ticket.title}</p>
        </div>
        <Badge variant={statusVariant(ticket.status_code)} className="text-sm px-3 py-1">{ticket.status_name}</Badge>
      </div>

      {error && <div className="rounded-lg border border-mrt-bad/25 bg-mrt-bad/5 p-3 text-sm text-mrt-bad dark:text-mrt-bad-light">{error}</div>}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.8fr)_minmax(280px,.8fr)]">
        {/* Main column */}
        <div className="grid gap-6">
          {/* Description */}
          <Card>
            <h2 className="mb-4 text-base font-bold text-stone-900 dark:text-stone-50">Descripción</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-600 dark:text-stone-300">{ticket.description || 'Sin descripción.'}</p>
          </Card>

          {/* Comments */}
          <Card>
            <h2 className="mb-4 text-base font-bold text-stone-900 dark:text-stone-50">
              Conversación <span className="ml-1.5 inline-grid h-5 min-w-[20px] place-items-center rounded-full bg-stone-100 px-1 text-xs font-extrabold text-stone-500 dark:bg-stone-700 dark:text-stone-400">{comments.length}</span>
            </h2>
            <div className="grid gap-3">
              {comments.length ? comments.map((comment) => (
                <article key={comment.id} className={cn(
                  'rounded-xl border p-4',
                  comment.is_private
                    ? 'border-dashed border-mrt-warn/30 bg-mrt-warn/5 dark:bg-mrt-warn/10'
                    : 'border-stone-100 bg-stone-50 dark:border-stone-700 dark:bg-stone-700/40'
                )}>
                  <div className="flex items-center justify-between gap-3">
                    <strong className="text-sm text-stone-800 dark:text-stone-100">{comment.author_name || 'Sistema'}</strong>
                    <div className="flex items-center gap-2">
                      {comment.is_private && <Badge variant="warning" className="text-[0.62rem]">Nota interna</Badge>}
                      <time className="text-xs text-stone-400">{new Date(comment.created_at).toLocaleString()}</time>
                    </div>
                  </div>
                  <p className="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed text-stone-600 dark:text-stone-300">{comment.content}</p>
                </article>
              )) : <p className="text-sm text-stone-400">Aún no hay comentarios.</p>}
            </div>
            <form className="mt-5 grid justify-items-end gap-3" onSubmit={commentForm.handleSubmit(onComment)}>
              <div className="w-full">
                <Textarea {...commentForm.register('content')} rows={3} placeholder="Escribe una actualización…" />
                <FieldError error={commentForm.formState.errors.content} />
              </div>
              <label className="flex items-center gap-2 justify-self-start text-sm text-stone-500">
                <input type="checkbox" {...commentForm.register('is_private')} className="accent-ore-500" /> Nota interna (no visible para el solicitante)
              </label>
              <Button disabled={busy === 'comment'}>{busy === 'comment' ? 'Enviando…' : 'Agregar comentario'}</Button>
            </form>
          </Card>

          {/* Files */}
          <Card>
            <h2 className="mb-4 text-base font-bold text-stone-900 dark:text-stone-50">
              Archivos <span className="ml-1.5 inline-grid h-5 min-w-[20px] place-items-center rounded-full bg-stone-100 px-1 text-xs font-extrabold text-stone-500 dark:bg-stone-700 dark:text-stone-400">{attachments.length}</span>
            </h2>
            <div className="grid gap-2">
              {attachments.map((file) => (
                <button key={file.id} onClick={() => void download(file)} className="flex items-center justify-between gap-4 rounded-lg border border-stone-100 bg-white p-3 text-left transition-colors hover:border-stone-200 hover:bg-stone-50 dark:border-stone-700 dark:bg-stone-800 dark:hover:bg-stone-700 cursor-pointer">
                  <span className="flex items-center gap-2 text-sm text-stone-800 dark:text-stone-100"><Paperclip className="h-3.5 w-3.5 text-stone-400" /> {file.filename}</span>
                  <small className="flex items-center gap-1 text-xs text-stone-400"><Download className="h-3 w-3" /> {Math.ceil(file.size_bytes / 1024)} KB</small>
                </button>
              ))}
            </div>
            <form className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={upload}>
              <Input name="file" type="file" required accept=".jpg,.jpeg,.png,.pdf,.txt,.docx,.xlsx,.zip" className="text-xs" />
              <Button variant="secondary" disabled={busy === 'file'}><Upload className="mr-1 h-3.5 w-3.5" /> {busy === 'file' ? 'Subiendo…' : 'Adjuntar'}</Button>
            </form>
            <p className="mt-2 text-xs text-stone-400">JPG, PNG, PDF, TXT, DOCX, XLSX o ZIP; hasta 10 MB.</p>
          </Card>

          {/* History */}
          <Card>
            <h2 className="mb-4 text-base font-bold text-stone-900 dark:text-stone-50">Historial</h2>
            <div className="grid gap-0">
              {history.map((item, index) => (
                <div key={`${item.created_at}-${index}`} className="grid grid-cols-[18px_1fr] gap-3">
                  <span className="relative mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-ore-500" />
                  <div className="pb-4">
                    <p className="text-sm text-stone-600 dark:text-stone-300"><strong className="text-stone-800 dark:text-stone-100">{item.to_status_name}</strong>{item.comment && <> · {item.comment}</>}</p>
                    <small className="mt-1 block text-xs text-stone-400">{new Date(item.created_at).toLocaleString()}</small>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <aside className="grid gap-6">
          {/* Requester */}
          <Card>
            <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ore-500 dark:text-ore-300">Persona que levantó el ticket</p>
            <div className="mt-4 flex items-center gap-3.5">
              <Avatar className="h-12 w-12 text-sm">{requesterInitials}</Avatar>
              <div className="min-w-0">
                <h2 className="text-base font-bold text-stone-900 break-words dark:text-stone-50">{ticket.requester_name || 'Solicitante sin identificar'}</h2>
                <p className="text-sm text-stone-500 break-words">{ticket.requester_email || 'Correo no disponible'}</p>
                <strong className="text-xs text-stone-400">{ticket.requester_number ? `USR-${String(ticket.requester_number).padStart(6, '0')}` : 'Sin número de usuario'}</strong>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-stone-100 bg-stone-50 p-2.5 dark:border-stone-700 dark:bg-stone-700/40">
                <small className="text-[0.66rem] font-bold uppercase text-stone-400"><MapPin className="mb-0.5 inline h-3 w-3" /> Ubicación</small>
                <strong className="mt-1 block text-xs font-bold text-stone-800 break-words dark:text-stone-100">{ticket.origin_area_name || 'Sin ubicación'}</strong>
              </div>
              <div className="rounded-lg border border-stone-100 bg-stone-50 p-2.5 dark:border-stone-700 dark:bg-stone-700/40">
                <small className="text-[0.66rem] font-bold uppercase text-stone-400"><Monitor className="mb-0.5 inline h-3 w-3" /> Equipo</small>
                <strong className="mt-1 block text-xs font-bold text-stone-800 break-words dark:text-stone-100">{ticket.requester_device_internal_id || 'Sin equipo'}</strong>
              </div>
            </div>
          </Card>

          {/* Related asset */}
          {ticket.asset_uid && (
            <Card>
              <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ore-500 dark:text-ore-300">Activo relacionado</p>
              {relatedAsset ? (
                <div className="mt-3">
                  <h2 className="text-base font-bold text-stone-900 dark:text-stone-50">{relatedAsset.center_code}</h2>
                  <p className="mt-1 text-sm text-stone-500">{relatedAsset.descripcion || `${relatedAsset.tipo || ''} ${relatedAsset.marca || ''} ${relatedAsset.modelo || ''}`.trim() || 'Sin descripción'}</p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="rounded-lg border border-stone-100 bg-stone-50 p-2.5 dark:border-stone-700 dark:bg-stone-700/40">
                      <small className="text-[0.66rem] font-bold uppercase text-stone-400">Estado</small>
                      <strong className="mt-1 block text-xs text-stone-800 dark:text-stone-100">{relatedAsset.estado || '—'}</strong>
                    </div>
                    <div className="rounded-lg border border-stone-100 bg-stone-50 p-2.5 dark:border-stone-700 dark:bg-stone-700/40">
                      <small className="text-[0.66rem] font-bold uppercase text-stone-400">Asignado a</small>
                      <strong className="mt-1 block text-xs text-stone-800 dark:text-stone-100">{relatedAsset.usuario_asignado || 'Sin asignar'}</strong>
                    </div>
                  </div>
                  <Button variant="secondary" className="mt-3 w-full" asChild>
                    <a href={`/activos/${relatedAsset.id}`} target="_blank" rel="noreferrer">Abrir activo</a>
                  </Button>
                </div>
              ) : (
                <p className="mt-3 text-sm text-stone-400">{assetError ? (assetError instanceof Error ? assetError.message : 'No se pudo consultar el activo relacionado') : 'Cargando…'}</p>
              )}
            </Card>
          )}

          {/* SLA */}
          {sla && (
            <Card className={cn('overflow-hidden', slaColorClass(sla.state))}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[0.68rem] font-extrabold uppercase tracking-[0.12em] text-ore-500 dark:text-ore-300">Acuerdo de servicio</p>
                  <h2 className="mt-1 text-lg font-extrabold text-stone-900 dark:text-stone-50">{sla.state}</h2>
                </div>
                <strong className="text-2xl font-extrabold text-ore-600 dark:text-ore-300">{sla.percentConsumed === null ? '—' : `${sla.percentConsumed}%`}</strong>
              </div>
              {sla.percentConsumed !== null && (
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-stone-100 dark:bg-stone-700" aria-label={`${sla.percentConsumed}% del SLA consumido`}>
                  <div className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-700 ease-out', slaBarClass(sla.state))} style={{ width: `${Math.max(Math.min(sla.percentConsumed, 100), 2)}%` }} />
                </div>
              )}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div><small className="text-xs text-stone-400">Tiempo transcurrido</small><strong className="mt-0.5 block text-sm text-stone-800 dark:text-stone-100">{duration(sla.elapsedMinutes)}</strong></div>
                <div><small className="text-xs text-stone-400">{sla.remainingMinutes !== null && sla.remainingMinutes < 0 ? 'Vencido hace' : 'Tiempo restante'}</small><strong className="mt-0.5 block text-sm text-stone-800 dark:text-stone-100">{duration(sla.remainingMinutes)}</strong></div>
              </div>
              {sla.deadline && <p className="mt-3 text-xs text-stone-400">Compromiso: {new Date(sla.deadline).toLocaleString()}</p>}
              {sla.pausedMinutes > 0 && <p className="mt-1 text-xs text-stone-400">En espera acumulada: {duration(sla.pausedMinutes)} — no cuenta contra el SLA.</p>}
            </Card>
          )}

          {/* Metadata */}
          <Card>
            <h2 className="mb-4 text-base font-bold text-stone-900 dark:text-stone-50">Información</h2>
            <dl className="grid gap-3">
              {[
                { icon: Shield, label: 'Área', value: ticket.business_area_name || 'Sin área' },
                { icon: Tag, label: 'Prioridad', value: ticket.priority_name || ticket.priority_code || 'Sin prioridad' },
                { icon: MapPin, label: 'Ubicación', value: ticket.origin_area_name || 'Sin ubicación', sub: [ticket.origin_site_name, ticket.origin_building_name, ticket.origin_floor_name].filter(Boolean).join(' · ') },
                { icon: Monitor, label: 'Equipo habitual', value: ticket.requester_device_internal_id || '—', sub: ticket.requester_device_name },
                { icon: Monitor, label: 'Equipo afectado', value: ticket.affected_device_internal_id || ticket.asset_number || '—', sub: ticket.affected_device_name },
                { icon: User, label: 'Responsable', value: ticket.assigned_to_name || 'Sin asignar' },
                { icon: CalendarDays, label: 'Creado', value: new Date(ticket.created_at).toLocaleString() },
              ].map((row) => (
                <div key={row.label} className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3 last:border-0 dark:border-stone-700">
                  <dt className="flex items-center gap-1.5 text-xs text-stone-400"><row.icon className="h-3 w-3" /> {row.label}</dt>
                  <dd className="text-right text-sm font-bold text-stone-800 dark:text-stone-100">
                    {row.value}
                    {row.sub && <small className="block font-normal text-stone-400">{row.sub}</small>}
                  </dd>
                </div>
              ))}
              <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3 dark:border-stone-700">
                <dt className="flex items-center gap-1.5 text-xs text-stone-400"><Tag className="h-3 w-3" /> Categorías</dt>
                <dd className="flex flex-wrap justify-end gap-1.5">
                  {ticket.categories?.length ? ticket.categories.map((item, index) => (
                    <span key={`${item.category_id}-${item.subcategory_id ?? index}`} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap dark:bg-stone-700">
                      {item.business_area_name ? `${item.business_area_name} · ` : ''}{item.category_name}{item.subcategory_name ? ` · ${item.subcategory_name}` : ''}
                    </span>
                  )) : <span className="text-sm font-bold text-stone-800 dark:text-stone-100">{ticket.category_name || 'Sin categoría'}</span>}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-1.5 text-xs text-stone-400"><User className="h-3 w-3" /> Origen</dt>
                <dd className="text-right text-sm font-bold text-stone-800 dark:text-stone-100">{ticket.requester_number ? `USR-${String(ticket.requester_number).padStart(6, '0')}` : 'Sin identificar'}</dd>
              </div>
            </dl>
            {assignees.length > 0 && (
              <div className="mt-5 grid gap-3 border-t border-stone-100 pt-4 dark:border-stone-700">
                <Button variant="secondary" className="w-full" onClick={() => void assignToMe()} disabled={busy === 'assign'}>{busy === 'assign' ? 'Asignando…' : 'Asignarme este ticket'}</Button>
                <form className="grid gap-2" onSubmit={assignForm.handleSubmit(onAssign)}>
                  <SelectNative {...assignForm.register('assignee')} defaultValue={ticket.assigned_to || ''}>
                    <option value="" disabled>Seleccionar responsable</option>
                    {assignees.map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
                  </SelectNative>
                  <FieldError error={assignForm.formState.errors.assignee} />
                  <Button variant="ghost" disabled={busy === 'assign'}>Asignar a esta persona</Button>
                </form>
              </div>
            )}
          </Card>

          {/* Change status */}
          <Card>
            <h2 className="mb-4 text-base font-bold text-stone-900 dark:text-stone-50">Cambiar estado</h2>
            {possibleStatuses.length ? (
              <form onSubmit={statusForm.handleSubmit(onStatusChange)} className="grid gap-4">
                <div>
                  <Label>Nuevo estado
                    <SelectNative {...statusForm.register('status')}>
                      <option value="" disabled>Seleccionar siguiente estado</option>
                      {possibleStatuses.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}
                    </SelectNative>
                  </Label>
                  <FieldError error={statusForm.formState.errors.status} />
                </div>
                <Label>Motivo
                  <Textarea {...statusForm.register('comment')} rows={3} placeholder="Describe el avance, bloqueo o solución" />
                </Label>
                <p className="text-xs text-stone-400">Los estados de espera, resolución, cierre, cancelación y reapertura requieren un motivo. Para resolver o cerrar, primero asigna una persona responsable.</p>
                <Button disabled={busy === 'status'}>{busy === 'status' ? 'Guardando…' : 'Actualizar estado'}</Button>
              </form>
            ) : <p className="text-sm text-stone-400">Este ticket está en un estado final y no tiene transiciones disponibles.</p>}
          </Card>
        </aside>
      </div>
    </div>
  );
}
