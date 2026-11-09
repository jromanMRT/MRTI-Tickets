import { FormEvent, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Box, Search, Ticket, UserRound, X } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import api from '@/services/api';
import { Input } from '@/components/ui/input';

interface SearchResults {
  tickets: Array<{ id: number; folio: string; title: string; status_name: string }>;
  people: Array<{ id: string; name?: string; email?: string; ticket_count: number }>;
  assets: Array<{ id: string; code?: string; name?: string; ticket_count: number }>;
  articles: Array<{ id: number; title: string; snippet?: string }>;
}

const RESULT_LINK = 'flex items-start justify-between gap-3 rounded-xl px-3 py-2 text-left hover:bg-stone-50 dark:hover:bg-stone-700 [&_span]:min-w-0 [&_strong]:block [&_strong]:truncate [&_strong]:text-sm [&_strong]:text-stone-800 dark:[&_strong]:text-stone-100 [&_small]:mt-0.5 [&_small]:block [&_small]:truncate [&_small]:text-xs [&_small]:text-stone-400 [&_em]:shrink-0 [&_em]:text-[0.68rem] [&_em]:not-italic [&_em]:text-stone-400';

function ticketHref(id: number) {
  const params = new URLSearchParams(window.location.search);
  params.set('ticket', String(id));
  return `?${params.toString()}`;
}

function ticketFilter(value: string) {
  const params = new URLSearchParams(window.location.search);
  params.set('q', value);
  params.delete('page');
  return `?${params.toString()}`;
}

export function WorkbenchSearch() {
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(draft.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [draft]);
  useEffect(() => { setOpen(false); }, [location.search]);
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const results = useQuery({
    queryKey: ['workbench-search', query],
    queryFn: () => api.get('/tickets/workbench/search', { params: { q: query } }).then((response) => response.data.data as SearchResults),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
  const data = results.data;
  const count = data ? data.tickets.length + data.people.length + data.assets.length + data.articles.length : 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (draft.trim().length >= 2) setOpen(true);
  }

  return (
    <div className="relative w-full max-w-[620px]" ref={ref}>
      <form onSubmit={submit}>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
        <Input value={draft} onFocus={() => { if (query.length >= 2) setOpen(true); }} onChange={(event) => { setDraft(event.target.value); setOpen(true); }} placeholder="Buscar tickets, solicitantes, activos o conocimiento…" className="h-11 bg-white pl-9 pr-10 shadow-sm dark:bg-stone-800" aria-label="Búsqueda operativa" />
        {draft && <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700" onClick={() => { setDraft(''); setQuery(''); setOpen(false); }} aria-label="Limpiar búsqueda"><X className="h-4 w-4" /></button>}
      </form>
      {open && query.length >= 2 && (
        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-40 max-h-[min(620px,70vh)] overflow-y-auto rounded-2xl border border-stone-200 bg-white p-3 shadow-2xl dark:border-stone-600 dark:bg-stone-800">
          {results.isLoading ? <p className="p-4 text-sm text-stone-400">Buscando…</p> : results.error ? <p className="p-4 text-sm text-mrt-bad">No se pudo completar la búsqueda.</p> : count === 0 ? <p className="p-4 text-sm text-stone-400">No se encontraron coincidencias accesibles.</p> : <>
            <ResultGroup icon={Ticket} label="Tickets">{data?.tickets.map((item) => <Link key={item.id} to={ticketHref(item.id)} className={RESULT_LINK}><span><strong>{item.folio}</strong><small>{item.title}</small></span><em>{item.status_name}</em></Link>)}</ResultGroup>
            <ResultGroup icon={UserRound} label="Solicitantes">{data?.people.map((item) => <Link key={item.id} to={ticketFilter(item.email || item.name || '')} className={RESULT_LINK}><span><strong>{item.name || 'Sin nombre'}</strong><small>{item.email || 'Sin correo'}</small></span><em>{item.ticket_count} tickets</em></Link>)}</ResultGroup>
            <ResultGroup icon={Box} label="Activos relacionados">{data?.assets.map((item) => <Link key={item.id} to={ticketFilter(item.code || item.id)} className={RESULT_LINK}><span><strong>{item.code || item.id}</strong><small>{item.name || 'Activo capturado en Tickets'}</small></span><em>{item.ticket_count} tickets</em></Link>)}</ResultGroup>
            <ResultGroup icon={BookOpen} label="Conocimiento">{data?.articles.map((item) => <a key={item.id} href={`/tickets/knowledge-base?open=${item.id}`} className={RESULT_LINK}><span><strong>{item.title}</strong><small>{item.snippet || 'Artículo publicado'}</small></span></a>)}</ResultGroup>
          </>}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ icon: Icon, label, children }: { icon: typeof Ticket; label: string; children: ReactNode }) {
  if (!children || (Array.isArray(children) && children.length === 0)) return null;
  return <section className="mb-3 last:mb-0"><h2 className="flex items-center gap-1.5 px-2 py-1 text-[0.66rem] font-extrabold uppercase tracking-wider text-stone-400"><Icon className="h-3.5 w-3.5" />{label}</h2><div className="grid gap-1">{children}</div></section>;
}
