import { useCallback, useEffect, useRef, useState } from 'react';

interface PortalNotification {
  id: string;
  title: string;
  message: string;
  timestamp?: string | null;
  href?: string | null;
}

function relativeTime(value?: string | null) {
  if (!value) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'Ahora';
  if (seconds < 3600) return `Hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `Hace ${Math.floor(seconds / 3600)} h`;
  return `Hace ${Math.floor(seconds / 86400)} d`;
}

export function PortalNotifications() {
  const [items, setItems] = useState<PortalNotification[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    try {
      const response = await fetch('/api/portal/v1/notifications', { headers: { Authorization: `Bearer ${token}` } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = await response.json();
      setItems(Array.isArray(body.data) ? body.data : []);
      setError('');
    } catch {
      setError('No fue posible consultar las notificaciones.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    function close(event: MouseEvent | KeyboardEvent) {
      if ((event instanceof KeyboardEvent && event.key === 'Escape') || (event instanceof MouseEvent && !rootRef.current?.contains(event.target as Node))) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, []);

  return <div className="portal-notifications" ref={rootRef}>
    <button type="button" className="portal-notification-button" onClick={() => { setOpen((value) => !value); if (!open) void load(); }} aria-label={items.length ? `Ver ${items.length} notificaciones` : 'Ver notificaciones'} aria-expanded={open}>
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>
      {items.length > 0 && <span>{items.length > 9 ? '9+' : items.length}</span>}
    </button>
    {open && <section className="portal-notification-panel" aria-label="Notificaciones">
      <header><div><small>Novedades</small><strong>Notificaciones</strong></div><button type="button" onClick={() => setOpen(false)} aria-label="Cerrar notificaciones">×</button></header>
      <div className="portal-notification-list" aria-live="polite">
        {loading ? <p>Buscando novedades…</p> : error ? <p className="error">{error}</p> : items.length === 0 ? <p>Sin novedades por ahora.</p> : items.map((item) => <article key={item.id}><b>TK</b><span><strong>{item.title}</strong><small>{item.message}</small><time>{relativeTime(item.timestamp)}</time></span>{item.href && <a href={item.href}>Abrir →</a>}</article>)}
      </div>
    </section>}
  </div>;
}
