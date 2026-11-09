import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Flag, UserCheck, X } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { dashboardKeys, ticketKeys } from '@/lib/query-keys';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { SelectNative } from '@/components/ui/select-native';
import { Textarea } from '@/components/ui/textarea';

interface Assignee { id: string; full_name: string }

export function TicketBulkActions({ ticketIds, onDone, onExport }: { ticketIds: number[]; onDone: () => void; onExport: () => void }) {
  const [mode, setMode] = useState<'assign' | 'escalate' | null>(null);
  const [assigneeId, setAssigneeId] = useState('me');
  const [reason, setReason] = useState('');
  const qc = useQueryClient();
  const assignees = useQuery({
    queryKey: ['workbench-bulk-assignees'],
    queryFn: () => api.get('/assignees').then((response) => response.data.data as Assignee[]),
    enabled: mode === 'assign',
    staleTime: 300_000,
  });

  function complete(message: string) {
    void qc.invalidateQueries({ queryKey: ticketKeys.lists() });
    void qc.invalidateQueries({ queryKey: dashboardKeys.summary() });
    setMode(null); setReason(''); onDone(); toast.success(message);
  }

  const assign = useMutation({
    mutationFn: () => {
      const person = assignees.data?.find((item) => item.id === assigneeId);
      return api.post('/tickets/workbench/bulk/assign', { ticket_ids: ticketIds, assigned_to: assigneeId, assigned_to_name: person?.full_name });
    },
    onSuccess: (response) => complete(response.data?.message || 'Tickets asignados'),
    onError: (error: any) => toast.error(error.response?.data?.error?.message || 'No se pudieron asignar los tickets'),
  });
  const escalate = useMutation({
    mutationFn: () => api.post('/tickets/workbench/bulk/escalate', { ticket_ids: ticketIds, reason: reason.trim() }),
    onSuccess: (response) => complete(response.data?.message || 'Tickets escalados'),
    onError: (error: any) => toast.error(error.response?.data?.error?.message || 'No se pudieron escalar los tickets'),
  });

  if (!ticketIds.length) return null;
  return <>
    <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-ore-300 bg-ore-50/95 px-3 py-2 shadow-lg backdrop-blur dark:border-ore-700 dark:bg-ore-900/90">
      <strong className="mr-auto text-sm text-stone-800 dark:text-stone-100">{ticketIds.length} seleccionados</strong>
      <Button type="button" size="sm" variant="secondary" onClick={() => setMode('assign')}><UserCheck className="h-3.5 w-3.5" />Asignar</Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => setMode('escalate')}><Flag className="h-3.5 w-3.5" />Escalar</Button>
      <Button type="button" size="sm" variant="secondary" onClick={onExport}><Download className="h-3.5 w-3.5" />Exportar</Button>
      <Button type="button" size="icon" variant="ghost" onClick={onDone} aria-label="Cancelar selección"><X className="h-4 w-4" /></Button>
    </div>
    <Dialog open={mode !== null} onOpenChange={(open) => { if (!open) setMode(null); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{mode === 'assign' ? 'Asignar tickets' : 'Escalar tickets'}</DialogTitle><DialogDescription>La acción se aplicará a {ticketIds.length} tickets y quedará registrada en auditoría.</DialogDescription></DialogHeader>
        {mode === 'assign' ? <SelectNative value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} aria-label="Responsable"><option value="me">Asignarme a mí</option>{(assignees.data || []).map((person) => <option key={person.id} value={person.id}>{person.full_name}</option>)}</SelectNative> : <Textarea rows={4} maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo del escalamiento…" />}
        <DialogFooter><Button type="button" variant="secondary" onClick={() => setMode(null)}>Cancelar</Button>{mode === 'assign' ? <Button type="button" disabled={!assigneeId || assign.isPending} onClick={() => assign.mutate()}>{assign.isPending ? 'Asignando…' : 'Confirmar asignación'}</Button> : <Button type="button" disabled={reason.trim().length < 3 || escalate.isPending} onClick={() => escalate.mutate()}>{escalate.isPending ? 'Escalando…' : 'Confirmar escalamiento'}</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
