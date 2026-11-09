import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, ExternalLink, FileText, Flag, Link2, Paperclip, Send, Tag, UserRound, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import api from '@/services/api';
import { catalogKeys, dashboardKeys, kbKeys, ticketKeys } from '@/lib/query-keys';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SelectNative } from '@/components/ui/select-native';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface Ticket {
  id: number; folio: string; title: string; description?: string; status_code: string; status_name: string;
  priority_code?: string; priority_name?: string; category_id?: number; category_name?: string;
  requester_name?: string; requester_email?: string; assigned_to?: string; assigned_to_name?: string;
  business_area_id?: number; business_area_name?: string; asset_uid?: string; asset_number?: string;
  origin_site_name?: string; origin_area_name?: string; affected_device_name?: string;
  affected_device_internal_id?: string; created_at: string; updated_at: string;
}
interface Status { code: string; name: string }
interface Workflow { allowed_statuses: Status[]; requires_reason_for: string[] }
interface Comment { id: number; author_name?: string; content: string; is_private: boolean; created_at: string }
interface Attachment { id: number; filename: string; size_bytes: number; created_at: string }
interface Assignee { id: string; full_name: string }
interface SlaStatus { state: string; percentConsumed: number | null; remainingMinutes: number | null; deadline: string | null; pausedMinutes: number }
interface HistoryResponse {
  status_history: Array<{ to_status_name: string; from_status_name?: string; comment?: string; created_at: string }>;
  assignments: Array<{ assigned_to_name?: string; note?: string; created_at: string }>;
  sla_events: Array<{ event_type: string; event_at: string }>;
}
interface KbSuggestion { id: number; title: string; snippet: string }
interface WorkbenchTag { id: number; name: string; color: string }
interface RelatedTicket { id: number; relation_type: string; ticket_id: number; folio: string; title: string; status_name: string; priority_code?: string }
interface SimilarTicket { id: number; folio: string; title: string; status_name: string; priority_code?: string }
interface WorkbenchContext {
  escalation: { escalated_at?: string | null; escalated_by?: string | null; escalation_reason?: string | null };
  tags: WorkbenchTag[];
  relations: RelatedTicket[];
  similar: SimilarTicket[];
}

function initials(name?: string) {
  return (name || 'SI').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function duration(minutes: number | null) {
  if (minutes === null) return 'No definido';
  const absolute = Math.abs(minutes);
  if (absolute < 60) return `${absolute} min`;
  const hours = Math.floor(absolute / 60);
  const rest = absolute % 60;
  return `${hours} h${rest ? ` ${rest} min` : ''}`;
}

function statusVariant(code?: string) {
  const value = String(code || '').toLowerCase();
  if (value === 'resolved' || value === 'closed') return 'status-resolved' as const;
  if (value === 'cancelled') return 'status-cancelled' as const;
  if (value.startsWith('on_hold')) return 'status-hold' as const;
  return 'status' as const;
}

function errorMessage(error: any, fallback: string) {
  return error?.response?.data?.error?.message || fallback;
}

export function TicketWorkspacePanel({ ticketId, onClose }: { ticketId: string | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState('conversation');
  const [message, setMessage] = useState('');
  const [statusCode, setStatusCode] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [escalationReason, setEscalationReason] = useState('');
  const [tagId, setTagId] = useState('');
  const id = ticketId || '';

  const ticketQuery = useQuery({
    queryKey: ticketKeys.detail(id),
    queryFn: () => api.get(`/tickets/${id}`).then((response) => response.data.data as Ticket),
    enabled: !!ticketId,
  });
  const ticket = ticketQuery.data;
  const workflowQuery = useQuery({
    queryKey: ticketKeys.workflow(id),
    queryFn: () => api.get(`/tickets/${id}/workflow`).then((response) => response.data.data as Workflow),
    enabled: !!ticketId,
  });
  const commentsQuery = useQuery({
    queryKey: ticketKeys.comments(id),
    queryFn: () => api.get(`/tickets/${id}/comments`).then((response) => response.data.data as Comment[]),
    enabled: !!ticketId,
  });
  const attachmentsQuery = useQuery({
    queryKey: ticketKeys.attachments(id),
    queryFn: () => api.get(`/tickets/${id}/attachments`).then((response) => response.data.data as Attachment[]),
    enabled: !!ticketId,
  });
  const historyQuery = useQuery({
    queryKey: ticketKeys.history(id),
    queryFn: () => api.get(`/tickets/${id}/history`).then((response) => response.data.data as HistoryResponse),
    enabled: !!ticketId,
  });
  const slaQuery = useQuery({
    queryKey: ticketKeys.sla(id),
    queryFn: () => api.get(`/tickets/${id}/sla-status`).then((response) => response.data.data as SlaStatus),
    enabled: !!ticketId,
  });
  const assigneesQuery = useQuery({
    queryKey: catalogKeys.assignees(ticket?.business_area_id),
    queryFn: () => api.get('/assignees', { params: ticket?.business_area_id ? { business_area_id: ticket.business_area_id } : {} }).then((response) => response.data.data as Assignee[]),
    enabled: !!ticket,
  });
  const suggestionsQuery = useQuery({
    queryKey: kbKeys.suggestions(`${ticket?.title || ''}:${ticket?.category_id || ''}`),
    queryFn: () => api.get('/kb-articles/suggestions', { params: { q: ticket?.title, category_id: ticket?.category_id } }).then((response) => response.data.data as KbSuggestion[]),
    enabled: !!ticket,
  });
  const contextQuery = useQuery({
    queryKey: ['workbench-context', id],
    queryFn: () => api.get(`/tickets/workbench/items/${id}/context`).then((response) => response.data.data as WorkbenchContext),
    enabled: !!ticketId,
  });
  const tagsQuery = useQuery({
    queryKey: ['workbench-tags'],
    queryFn: () => api.get('/tickets/workbench/tags').then((response) => response.data.data as WorkbenchTag[]),
    enabled: !!ticketId,
    staleTime: 300_000,
  });

  function refreshTicket() {
    void qc.invalidateQueries({ queryKey: ticketKeys.detail(id) });
    void qc.invalidateQueries({ queryKey: ticketKeys.workflow(id) });
    void qc.invalidateQueries({ queryKey: ticketKeys.history(id) });
    void qc.invalidateQueries({ queryKey: ticketKeys.sla(id) });
    void qc.invalidateQueries({ queryKey: ticketKeys.lists() });
    void qc.invalidateQueries({ queryKey: dashboardKeys.summary() });
  }

  const commentMutation = useMutation({
    mutationFn: () => api.post(`/tickets/${id}/comments`, { content: message.trim(), is_private: activeTab === 'notes' }),
    onSuccess: () => {
      setMessage('');
      void qc.invalidateQueries({ queryKey: ticketKeys.comments(id) });
      void qc.invalidateQueries({ queryKey: ticketKeys.lists() });
      toast.success(activeTab === 'notes' ? 'Nota interna agregada' : 'Respuesta agregada');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo agregar el mensaje')),
  });
  const statusMutation = useMutation({
    mutationFn: () => api.patch(`/tickets/${id}/status`, { to_status_code: statusCode, comment: statusReason.trim() }),
    onSuccess: () => {
      setStatusCode(''); setStatusReason(''); refreshTicket(); toast.success('Estado actualizado');
    },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo actualizar el estado')),
  });
  const assignMutation = useMutation({
    mutationFn: (assignedTo: string) => {
      const person = assigneesQuery.data?.find((item) => item.id === assignedTo);
      return api.post(`/tickets/${id}/assign`, {
        assigned_to: assignedTo,
        assigned_to_name: person?.full_name,
        note: 'Asignación desde la bandeja operativa',
      });
    },
    onSuccess: () => { setAssigneeId(''); refreshTicket(); toast.success('Responsable actualizado'); },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo asignar el ticket')),
  });
  const uploadMutation = useMutation({
    mutationFn: (body: FormData) => api.post(`/tickets/${id}/attachments`, body),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ticketKeys.attachments(id) }); toast.success('Archivo adjuntado'); },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo adjuntar el archivo')),
  });
  const escalateMutation = useMutation({
    mutationFn: () => api.post(`/tickets/workbench/items/${id}/escalate`, { reason: escalationReason.trim() }),
    onSuccess: () => { setEscalationReason(''); void contextQuery.refetch(); void qc.invalidateQueries({ queryKey: ticketKeys.lists() }); toast.success('Ticket escalado'); },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo escalar el ticket')),
  });
  const deescalateMutation = useMutation({
    mutationFn: () => api.post(`/tickets/workbench/items/${id}/deescalate`),
    onSuccess: () => { void contextQuery.refetch(); void qc.invalidateQueries({ queryKey: ticketKeys.lists() }); toast.success('Escalamiento retirado'); },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo retirar el escalamiento')),
  });
  const addTagMutation = useMutation({
    mutationFn: () => api.post(`/tickets/workbench/items/${id}/tags`, { tag_id: Number(tagId) }),
    onSuccess: () => { setTagId(''); void contextQuery.refetch(); toast.success('Etiqueta agregada'); },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo agregar la etiqueta')),
  });
  const removeTagMutation = useMutation({
    mutationFn: (removeId: number) => api.post(`/tickets/workbench/items/${id}/tags/${removeId}/remove`),
    onSuccess: () => { void contextQuery.refetch(); toast.success('Etiqueta retirada'); },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo quitar la etiqueta')),
  });
  const relationMutation = useMutation({
    mutationFn: (relatedId: number) => api.post(`/tickets/workbench/items/${id}/relations`, { related_ticket_id: relatedId, relation_type: 'related' }),
    onSuccess: () => { void contextQuery.refetch(); toast.success('Ticket relacionado'); },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo relacionar el ticket')),
  });
  const removeRelationMutation = useMutation({
    mutationFn: (relationId: number) => api.post(`/tickets/workbench/items/${id}/relations/${relationId}/remove`),
    onSuccess: () => { void contextQuery.refetch(); toast.success('Relación retirada'); },
    onError: (error) => toast.error(errorMessage(error, 'No se pudo quitar la relación')),
  });

  const publicComments = (commentsQuery.data || []).filter((item) => !item.is_private);
  const privateComments = (commentsQuery.data || []).filter((item) => item.is_private);
  const visibleComments = activeTab === 'notes' ? privateComments : publicComments;
  const requiresReason = workflowQuery.data?.requires_reason_for.includes(statusCode) || false;
  const activity = useMemo(() => {
    const history = historyQuery.data;
    if (!history) return [];
    return [
      ...history.status_history.map((item) => ({ date: item.created_at, title: `Estado: ${item.to_status_name}`, detail: item.comment || item.from_status_name || '' })),
      ...history.assignments.map((item) => ({ date: item.created_at, title: `Asignado a ${item.assigned_to_name || 'un responsable'}`, detail: item.note || '' })),
      ...history.sla_events.map((item) => ({ date: item.event_at, title: `SLA: ${item.event_type}`, detail: '' })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [historyQuery.data]);

  async function download(file: Attachment) {
    try {
      const response = await api.get(`/tickets/${id}/attachments/${file.id}`, { responseType: 'blob' });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url; link.download = file.filename; link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(errorMessage(error, 'No se pudo descargar el archivo'));
    }
  }

  function submitMessage(event: FormEvent) {
    event.preventDefault();
    if (message.trim()) commentMutation.mutate();
  }

  function submitStatus(event: FormEvent) {
    event.preventDefault();
    if (!statusCode) return;
    if (requiresReason && !statusReason.trim()) {
      toast.error('Escribe el motivo del cambio de estado');
      return;
    }
    statusMutation.mutate();
  }

  function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = new FormData(form);
    uploadMutation.mutate(body, { onSuccess: () => form.reset() });
  }

  return (
    <Dialog open={!!ticketId} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="left-auto right-0 top-0 grid h-dvh w-full max-w-[760px] translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-none border-y-0 border-r-0 p-0 sm:w-[min(760px,calc(100vw-72px))]" aria-describedby="ticket-panel-description">
        <div className="border-b border-stone-200 px-5 py-4 pr-14 dark:border-stone-700">
          {ticket ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-sm font-extrabold text-ore-600 dark:text-ore-300">{ticket.folio}</DialogTitle>
                <Badge variant={statusVariant(ticket.status_code)}>{ticket.status_name}</Badge>
                {ticket.priority_code && <Badge variant={`priority-${ticket.priority_code.toLowerCase()}` as any}>{ticket.priority_name || ticket.priority_code}</Badge>}
              </div>
              <h2 className="mt-2 text-xl font-extrabold text-stone-900 dark:text-stone-50">{ticket.title}</h2>
              <DialogDescription id="ticket-panel-description" className="mt-1">
                {ticket.requester_name || 'Solicitante sin identificar'} · Creado {new Date(ticket.created_at).toLocaleString('es-MX')}
              </DialogDescription>
            </>
          ) : <><DialogTitle>Cargando ticket</DialogTitle><DialogDescription id="ticket-panel-description">Consultando información operativa.</DialogDescription></>}
        </div>

        {ticketQuery.error ? (
          <div className="p-6 text-sm text-mrt-bad">No se pudo cargar el ticket.</div>
        ) : ticketQuery.isLoading || !ticket ? (
          <div className="grid gap-4 overflow-auto p-5"><Skeleton className="h-40" /><Skeleton className="h-64" /></div>
        ) : (
          <div className="grid min-h-0 grid-cols-1 overflow-y-auto xl:grid-cols-[minmax(0,1fr)_250px] xl:overflow-hidden">
            <section className="min-w-0 border-stone-200 xl:overflow-y-auto xl:border-r dark:border-stone-700">
              <div className="border-b border-stone-100 px-5 py-4 dark:border-stone-700">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-stone-600 dark:text-stone-300">{ticket.description || 'Sin descripción.'}</p>
              </div>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="px-5 py-4">
                <TabsList className="border-b border-stone-200 dark:border-stone-700">
                  <TabsTrigger value="conversation">Conversación ({publicComments.length})</TabsTrigger>
                  <TabsTrigger value="notes">Notas internas ({privateComments.length})</TabsTrigger>
                  <TabsTrigger value="attachments">Adjuntos ({attachmentsQuery.data?.length || 0})</TabsTrigger>
                  <TabsTrigger value="activity">Actividad</TabsTrigger>
                </TabsList>

                <TabsContent value="conversation">
                  <MessageList comments={visibleComments} />
                  <MessageComposer value={message} onChange={setMessage} onSubmit={submitMessage} pending={commentMutation.isPending} label="Responder en el ticket" />
                </TabsContent>
                <TabsContent value="notes">
                  <MessageList comments={visibleComments} />
                  <MessageComposer value={message} onChange={setMessage} onSubmit={submitMessage} pending={commentMutation.isPending} label="Agregar nota interna" privateNote />
                </TabsContent>
                <TabsContent value="attachments">
                  <div className="grid gap-2">
                    {(attachmentsQuery.data || []).map((file) => (
                      <button key={file.id} type="button" onClick={() => void download(file)} className="flex items-center justify-between gap-3 rounded-xl border border-stone-200 p-3 text-left hover:bg-stone-50 dark:border-stone-700 dark:hover:bg-stone-700/40">
                        <span className="min-w-0"><span className="flex items-center gap-2 truncate text-sm font-bold"><Paperclip className="h-4 w-4 text-stone-400" />{file.filename}</span><small className="text-stone-400">{Math.ceil(file.size_bytes / 1024)} KB</small></span>
                        <Download className="h-4 w-4 shrink-0 text-stone-400" />
                      </button>
                    ))}
                    {!attachmentsQuery.data?.length && <p className="py-8 text-center text-sm text-stone-400">No hay archivos adjuntos.</p>}
                  </div>
                  <form className="mt-4 grid gap-3" onSubmit={upload}>
                    <Input name="file" type="file" required accept=".jpg,.jpeg,.png,.pdf,.txt,.docx,.xlsx,.zip" />
                    <Button disabled={uploadMutation.isPending}>{uploadMutation.isPending ? 'Subiendo…' : 'Adjuntar archivo'}</Button>
                  </form>
                </TabsContent>
                <TabsContent value="activity">
                  <div className="grid gap-0">
                    {activity.map((item, index) => (
                      <div key={`${item.date}-${index}`} className="grid grid-cols-[12px_1fr] gap-3 border-b border-stone-100 py-3 last:border-0 dark:border-stone-700">
                        <span className="mt-1.5 h-2.5 w-2.5 rounded-full border-2 border-ore-500" />
                        <span><strong className="block text-sm text-stone-800 dark:text-stone-100">{item.title}</strong>{item.detail && <span className="mt-0.5 block text-xs text-stone-500">{item.detail}</span>}<time className="mt-1 block text-xs text-stone-400">{new Date(item.date).toLocaleString('es-MX')}</time></span>
                      </div>
                    ))}
                    {!activity.length && <p className="py-8 text-center text-sm text-stone-400">Aún no hay actividad registrada.</p>}
                  </div>
                </TabsContent>
              </Tabs>
            </section>

            <aside className="grid content-start gap-4 bg-stone-50/70 p-4 xl:overflow-y-auto dark:bg-stone-900/30">
              {slaQuery.data && <SlaCard sla={slaQuery.data} />}
              <EscalationCard context={contextQuery.data} reason={escalationReason} onReasonChange={setEscalationReason} onEscalate={() => escalateMutation.mutate()} onDeescalate={() => deescalateMutation.mutate()} pending={escalateMutation.isPending || deescalateMutation.isPending} />
              <form className="grid gap-2 rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800" onSubmit={submitStatus}>
                <strong className="text-sm text-stone-800 dark:text-stone-100">Estado</strong>
                <SelectNative value={statusCode} onChange={(event) => setStatusCode(event.target.value)} aria-label="Nuevo estado">
                  <option value="">{ticket.status_name}</option>
                  {(workflowQuery.data?.allowed_statuses || []).map((status) => <option key={status.code} value={status.code}>{status.name}</option>)}
                </SelectNative>
                {statusCode && <Textarea rows={2} value={statusReason} onChange={(event) => setStatusReason(event.target.value)} placeholder={requiresReason ? 'Motivo requerido' : 'Nota del cambio (opcional)'} />}
                {statusCode && <Button size="sm" disabled={statusMutation.isPending}>{statusMutation.isPending ? 'Guardando…' : 'Actualizar estado'}</Button>}
              </form>
              <div className="grid gap-2 rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800">
                <strong className="text-sm text-stone-800 dark:text-stone-100">Responsable</strong>
                <span className="flex items-center gap-2 text-xs text-stone-500"><UserRound className="h-3.5 w-3.5" />{ticket.assigned_to_name || 'Sin asignar'}</span>
                <SelectNative value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} aria-label="Asignar responsable">
                  <option value="">Seleccionar persona</option>
                  {(assigneesQuery.data || []).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}
                </SelectNative>
                <Button size="sm" variant="secondary" disabled={!assigneeId || assignMutation.isPending} onClick={() => assignMutation.mutate(assigneeId)}>Asignar</Button>
              </div>
              <DetailList ticket={ticket} />
              <TagsCard tags={contextQuery.data?.tags || []} catalog={tagsQuery.data || []} selected={tagId} onSelected={setTagId} onAdd={() => addTagMutation.mutate()} onRemove={(removeId) => removeTagMutation.mutate(removeId)} pending={addTagMutation.isPending || removeTagMutation.isPending} />
              <RelatedCard relations={contextQuery.data?.relations || []} similar={contextQuery.data?.similar || []} onAdd={(relatedId) => relationMutation.mutate(relatedId)} onRemove={(relationId) => removeRelationMutation.mutate(relationId)} pending={relationMutation.isPending || removeRelationMutation.isPending} />
              {!!suggestionsQuery.data?.length && (
                <div className="rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800">
                  <strong className="text-sm text-stone-800 dark:text-stone-100">Artículos sugeridos</strong>
                  <div className="mt-2 grid gap-2">
                    {suggestionsQuery.data.slice(0, 3).map((article) => <a key={article.id} className="rounded-lg border border-stone-100 p-2 text-xs font-bold text-ore-600 hover:bg-stone-50 dark:border-stone-700 dark:text-ore-300 dark:hover:bg-stone-700" href={`/tickets/knowledge-base?open=${article.id}`}><FileText className="mr-1 inline h-3.5 w-3.5" />{article.title}</a>)}
                  </div>
                </div>
              )}
              <Button variant="ghost" size="sm" asChild><a href={`/tickets/tickets/${ticket.id}`}>Abrir ficha completa <ExternalLink className="ml-1 h-3.5 w-3.5" /></a></Button>
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function MessageList({ comments }: { comments: Comment[] }) {
  if (!comments.length) return <p className="py-8 text-center text-sm text-stone-400">Aún no hay mensajes.</p>;
  return <div className="grid gap-3">{comments.map((comment) => <article key={comment.id} className={cn('rounded-xl border p-3', comment.is_private ? 'border-mrt-warn/30 bg-mrt-warn/5' : 'border-stone-200 bg-stone-50 dark:border-stone-700 dark:bg-stone-700/30')}><div className="flex items-center gap-2"><Avatar className="h-8 w-8 text-[0.62rem]">{initials(comment.author_name)}</Avatar><span className="min-w-0"><strong className="block truncate text-sm text-stone-800 dark:text-stone-100">{comment.author_name || 'Sistema'}</strong><time className="text-xs text-stone-400">{new Date(comment.created_at).toLocaleString('es-MX')}</time></span></div><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-stone-600 dark:text-stone-300">{comment.content}</p></article>)}</div>;
}

function MessageComposer({ value, onChange, onSubmit, pending, label, privateNote = false }: { value: string; onChange: (value: string) => void; onSubmit: (event: FormEvent) => void; pending: boolean; label: string; privateNote?: boolean }) {
  return <form className="sticky bottom-0 mt-4 grid gap-2 border-t border-stone-200 bg-white pt-4 dark:border-stone-700 dark:bg-stone-800" onSubmit={onSubmit}><label className="text-xs font-bold text-stone-500">{label}</label><Textarea rows={3} maxLength={5000} value={value} onChange={(event) => onChange(event.target.value)} placeholder={privateNote ? 'Visible sólo para el equipo de atención…' : 'Escribe una actualización…'} /><div className="flex items-center justify-between gap-3"><small className="text-stone-400">{value.length}/5000</small><Button size="sm" disabled={!value.trim() || pending}><Send className="mr-1 h-3.5 w-3.5" />{pending ? 'Enviando…' : privateNote ? 'Guardar nota' : 'Enviar respuesta'}</Button></div></form>;
}

function SlaCard({ sla }: { sla: SlaStatus }) {
  const percent = Math.max(0, Math.min(sla.percentConsumed || 0, 100));
  return <div className="rounded-xl border border-mrt-good/25 bg-mrt-good/5 p-3"><div className="flex items-center justify-between gap-2"><strong className="text-sm text-stone-800 dark:text-stone-100">SLA: {sla.state}</strong><span className="text-xs font-bold text-mrt-good">{sla.percentConsumed === null ? '—' : `${sla.percentConsumed}%`}</span></div>{sla.percentConsumed !== null && <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-stone-200 dark:bg-stone-700"><div className="h-full rounded-full bg-mrt-good" style={{ width: `${Math.max(percent, 2)}%` }} /></div>}<p className="mt-2 text-xs text-stone-500">{sla.remainingMinutes !== null && sla.remainingMinutes < 0 ? 'Vencido hace' : 'Tiempo restante'}: <strong>{duration(sla.remainingMinutes)}</strong></p>{sla.deadline && <p className="mt-1 text-xs text-stone-400">Compromiso: {new Date(sla.deadline).toLocaleString('es-MX')}</p>}</div>;
}

function EscalationCard({ context, reason, onReasonChange, onEscalate, onDeescalate, pending }: { context?: WorkbenchContext; reason: string; onReasonChange: (value: string) => void; onEscalate: () => void; onDeescalate: () => void; pending: boolean }) {
  const escalation = context?.escalation;
  const escalated = !!escalation?.escalated_at;
  return <div className={cn('rounded-xl border bg-white p-3 dark:bg-stone-800', escalated ? 'border-mrt-bad/35' : 'border-stone-200 dark:border-stone-700')}><div className="flex items-center justify-between gap-2"><strong className="flex items-center gap-1.5 text-sm text-stone-800 dark:text-stone-100"><Flag className={cn('h-4 w-4', escalated ? 'fill-mrt-bad text-mrt-bad' : 'text-stone-400')} />Escalamiento</strong>{escalated && <Badge variant="danger">Escalado</Badge>}</div>{escalated ? <><p className="mt-2 text-xs leading-relaxed text-stone-500">{escalation?.escalation_reason}</p><small className="mt-1 block text-stone-400">{new Date(escalation!.escalated_at!).toLocaleString('es-MX')}</small><Button type="button" size="sm" variant="secondary" className="mt-3 w-full" disabled={pending} onClick={onDeescalate}>Retirar escalamiento</Button></> : <><Textarea className="mt-2" rows={2} maxLength={500} value={reason} onChange={(event) => onReasonChange(event.target.value)} placeholder="Motivo del escalamiento…" /><Button type="button" size="sm" variant="secondary" className="mt-2 w-full" disabled={reason.trim().length < 3 || pending} onClick={onEscalate}>Escalar ticket</Button></>}</div>;
}

const tagTone: Record<string, string> = {
  stone: 'bg-stone-100 text-stone-600 dark:bg-stone-700 dark:text-stone-200',
  blue: 'bg-mrt-info/15 text-blue-700 dark:text-blue-200',
  green: 'bg-mrt-good/15 text-green-700 dark:text-green-200',
  amber: 'bg-mrt-warn/15 text-amber-700 dark:text-amber-200',
  red: 'bg-mrt-bad/15 text-red-700 dark:text-red-200',
  purple: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-200',
};

function TagsCard({ tags, catalog, selected, onSelected, onAdd, onRemove, pending }: { tags: WorkbenchTag[]; catalog: WorkbenchTag[]; selected: string; onSelected: (value: string) => void; onAdd: () => void; onRemove: (id: number) => void; pending: boolean }) {
  const assigned = new Set(tags.map((tag) => tag.id));
  const available = catalog.filter((tag) => !assigned.has(tag.id));
  return <div className="rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800"><strong className="flex items-center gap-1.5 text-sm text-stone-800 dark:text-stone-100"><Tag className="h-4 w-4 text-stone-400" />Etiquetas</strong><div className="mt-2 flex flex-wrap gap-1.5">{tags.map((tag) => <span key={tag.id} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.68rem] font-bold', tagTone[tag.color] || tagTone.stone)}>{tag.name}<button type="button" onClick={() => onRemove(tag.id)} disabled={pending} aria-label={`Quitar ${tag.name}`}><X className="h-3 w-3" /></button></span>)}{!tags.length && <small className="text-stone-400">Sin etiquetas</small>}</div>{available.length > 0 && <div className="mt-3 flex gap-2"><SelectNative className="min-w-0" value={selected} onChange={(event) => onSelected(event.target.value)} aria-label="Etiqueta"><option value="">Agregar etiqueta</option>{available.map((tag) => <option key={tag.id} value={tag.id}>{tag.name}</option>)}</SelectNative><Button type="button" size="sm" variant="secondary" disabled={!selected || pending} onClick={onAdd}>Agregar</Button></div>}</div>;
}

function relatedHref(ticketId: number) {
  const params = new URLSearchParams(window.location.search);
  params.set('ticket', String(ticketId));
  return `?${params.toString()}`;
}

function RelatedCard({ relations, similar, onAdd, onRemove, pending }: { relations: RelatedTicket[]; similar: SimilarTicket[]; onAdd: (id: number) => void; onRemove: (id: number) => void; pending: boolean }) {
  const relatedIds = new Set(relations.map((item) => item.ticket_id));
  return <div className="rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800"><strong className="flex items-center gap-1.5 text-sm text-stone-800 dark:text-stone-100"><Link2 className="h-4 w-4 text-stone-400" />Tickets relacionados</strong><div className="mt-2 grid gap-2">{relations.map((item) => <div key={item.id} className="flex items-start justify-between gap-2 rounded-lg border border-stone-100 p-2 dark:border-stone-700"><Link to={relatedHref(item.ticket_id)} className="min-w-0"><strong className="block text-xs text-ore-600 dark:text-ore-300">{item.folio}</strong><small className="block truncate text-stone-400">{item.title}</small></Link><button type="button" onClick={() => onRemove(item.id)} disabled={pending} className="text-stone-400 hover:text-mrt-bad" aria-label={`Quitar relación con ${item.folio}`}><X className="h-3.5 w-3.5" /></button></div>)}{!relations.length && <small className="text-stone-400">No hay relaciones explícitas.</small>}</div>{similar.some((item) => !relatedIds.has(item.id)) && <div className="mt-3 border-t border-stone-100 pt-3 dark:border-stone-700"><small className="font-bold text-stone-500">Posibles similares</small><div className="mt-2 grid gap-2">{similar.filter((item) => !relatedIds.has(item.id)).slice(0, 3).map((item) => <div key={item.id} className="flex items-center justify-between gap-2"><Link to={relatedHref(item.id)} className="min-w-0 truncate text-xs font-bold text-ore-600 dark:text-ore-300">{item.folio} · {item.title}</Link><button type="button" className="shrink-0 text-[0.65rem] font-bold text-stone-500 hover:text-ore-600" disabled={pending} onClick={() => onAdd(item.id)}>Relacionar</button></div>)}</div></div>}</div>;
}

function DetailList({ ticket }: { ticket: Ticket }) {
  const rows = [
    ['Área', ticket.business_area_name || 'Sin área'],
    ['Categoría', ticket.category_name || 'Sin categoría'],
    ['Ubicación', ticket.origin_area_name || ticket.origin_site_name || 'Sin ubicación'],
    ['Equipo', ticket.affected_device_internal_id || ticket.affected_device_name || 'Sin equipo'],
    ['Activo', ticket.asset_number || ticket.asset_uid || 'Sin activo'],
    ['Solicitante', ticket.requester_email || ticket.requester_name || 'Sin identificar'],
  ];
  return <dl className="grid gap-2 rounded-xl border border-stone-200 bg-white p-3 dark:border-stone-700 dark:bg-stone-800">{rows.map(([label, value]) => <div key={label} className="border-b border-stone-100 pb-2 last:border-0 last:pb-0 dark:border-stone-700"><dt className="text-[0.65rem] font-bold uppercase tracking-wide text-stone-400">{label}</dt><dd className="mt-0.5 break-words text-xs font-bold text-stone-700 dark:text-stone-200">{value}</dd></div>)}</dl>;
}
