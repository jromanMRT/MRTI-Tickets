import { useEffect, useRef, useState } from 'react';
import { Route, Routes, NavLink, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
import NewTicket from './pages/NewTicket';
import SlaPolicies from './pages/SlaPolicies';
import KnowledgeBase from './pages/KnowledgeBase';
import api from './services/api';
import { useTheme } from './hooks/useTheme';
import { PortalNotifications } from './components/PortalNotifications';
import { ModuleSwitcher } from './components/ModuleSwitcher';
import './style.css';
import './shell.css';

function AccountMenu({ profile, onLogout }: { profile: { full_name?: string; role?: string }; onLogout: () => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const name = profile.full_name || 'Usuario';
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); };
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnEscape);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', closeOnEscape); };
  }, []);
  return <div className="account-menu" ref={ref}>
    <button type="button" className="session-profile" onClick={() => setOpen((value) => !value)} aria-label="Abrir menú de usuario" aria-expanded={open}>
      <span className="session-avatar" aria-hidden="true">{initials}</span><span className="account-identity"><strong>{name}</strong><small>{profile.role || 'Sesión activa'}</small></span><span className="account-chevron" aria-hidden="true">⌄</span>
    </button>
    {open && <div className="account-menu-panel" role="menu">
      <a href="/?view=account" role="menuitem"><span aria-hidden="true">○</span>Perfil</a>
      {profile.role === 'administrator' && <a href="/?view=brand-assets" role="menuitem"><span aria-hidden="true">◆</span>Recursos de marca</a>}
      {profile.role === 'administrator' && <a href="/?view=control-center" role="menuitem"><span aria-hidden="true">⚙</span>Centro de control</a>}
      <button type="button" className="account-menu-logout" onClick={onLogout} role="menuitem"><span aria-hidden="true">↪</span>Cerrar sesión</button>
    </div>}
  </div>;
}

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('mrti_tickets_sidebar_collapsed') === '1');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState('/company-logo.svg');
  const [theme, setTheme] = useTheme();
  const location = useLocation();
  let profile: { full_name?: string; role?: string } = {};
  try { profile = JSON.parse(localStorage.getItem('auth_profile') || '{}'); } catch { profile = {}; }
  const routeTitle = location.pathname === '/'
    ? 'Resumen'
    : location.pathname === '/tickets/new'
      ? 'Nuevo ticket'
      : location.pathname === '/settings/sla-policies'
        ? 'Políticas de SLA'
      : location.pathname === '/knowledge-base'
        ? 'Base de conocimiento'
      : location.pathname.startsWith('/tickets/')
        ? 'Detalle del ticket'
        : 'Tickets';

  async function handleLogout() {
    try {
      const token = localStorage.getItem('auth_token');
      await fetch('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: '{}' });
    } catch { /* cierre local garantizado aunque el aviso a Core falle */ }
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_profile');
    window.location.replace('/');
  }

  useEffect(() => {
    const expired = () => setAuthenticated(false);
    window.addEventListener('mrti-auth-expired', expired);
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setCheckingSession(false);
      return () => window.removeEventListener('mrti-auth-expired', expired);
    }
    api.get('/session').then(() => setAuthenticated(true)).catch(() => setAuthenticated(false)).finally(() => setCheckingSession(false));
    return () => window.removeEventListener('mrti-auth-expired', expired);
  }, []);

  // El logo lo administra Core (Centro de control → Recursos de marca); se
  // consulta en vivo para que un cambio ahí se refleje aquí sin tocar código.
  useEffect(() => {
    fetch('/api/portal/v1/brand-appearance', { cache: 'no-store' })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(({ data }) => { if (data?.portal_logo?.content_url) setLogoUrl(data.portal_logo.content_url); })
      .catch(() => {});
  }, []);

  useEffect(() => setMobileMenuOpen(false), [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileMenuOpen]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, []);

  if (checkingSession) return <main className="login-shell"><div className="login-card">Validando sesión…</div></main>;

  if (!authenticated) {
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(`/?returnTo=${encodeURIComponent(returnTo)}`);
    return <main className="login-shell"><div className="login-card">Redirigiendo al acceso central…</div></main>;
  }

  function toggleCollapse() {
    setCollapsed((prev) => {
      localStorage.setItem('mrti_tickets_sidebar_collapsed', prev ? '0' : '1');
      return !prev;
    });
  }

  return (
    <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}${mobileMenuOpen ? ' mobile-menu-open' : ''}`}>
      <button className="sidebar-backdrop" type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar navegación" />
      <aside className="sidebar" id="tickets-sidebar" aria-label="Navegación de Tickets">
        <div className="brand-row">
          <a href="/" title="Ir al home" aria-label="Ir al home" className="brand-home"><span className="brand-mark"><img src={logoUrl} alt="" /></span><span className="brand-text"><strong><span>MRTI</span><span className="brand-module">Tickets</span></strong><small>Minera Río Tinto</small></span></a>
        </div>
        <nav>
          <NavLink to="/" end onClick={() => setMobileMenuOpen(false)}><span className="nav-icon" aria-hidden="true">⌂</span><span className="nav-label">Resumen</span></NavLink>
          <NavLink to="/tickets" onClick={() => setMobileMenuOpen(false)}><span className="nav-icon" aria-hidden="true">◇</span><span className="nav-label">Tickets</span></NavLink>
          <NavLink to="/tickets/new" onClick={() => setMobileMenuOpen(false)}><span className="nav-icon" aria-hidden="true">＋</span><span className="nav-label">Nuevo ticket</span></NavLink>
          <NavLink to="/knowledge-base" onClick={() => setMobileMenuOpen(false)}><span className="nav-icon" aria-hidden="true">📘</span><span className="nav-label">Base de conocimiento</span></NavLink>
          {profile.role === 'administrator' && <NavLink to="/settings/sla-policies" onClick={() => setMobileMenuOpen(false)}><span className="nav-icon" aria-hidden="true">⏱</span><span className="nav-label">Políticas de SLA</span></NavLink>}
        </nav>
        <div className="sidebar-footer">
          <button
            type="button"
            className="icon-button sidebar-collapse-button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-label="Cambiar tema"
            aria-pressed={theme === 'dark'}
          >
            {theme === 'dark' ? '🌙' : '☀️'}
          </button>
          <button
            type="button"
            className="icon-button"
            onClick={toggleCollapse}
            title={collapsed ? 'Expandir' : 'Colapsar'}
            aria-label={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
          >
            {collapsed ? '»' : '«'}
          </button>
        </div>
      </aside>
      <main className="content">
        <header className="topbar">
          <button type="button" className="mobile-menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="Abrir navegación" aria-expanded={mobileMenuOpen} aria-controls="tickets-sidebar">☰</button>
          <ModuleSwitcher />
          <span><strong>{routeTitle}</strong><small>MRTI Tickets</small></span>
          <div className="session-controls"><PortalNotifications /><AccountMenu profile={profile} onLogout={() => void handleLogout()} /></div>
        </header>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/tickets/new" element={<NewTicket />} />
          <Route path="/knowledge-base" element={<KnowledgeBase />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/settings/sla-policies" element={<SlaPolicies />} />
          <Route path="/settings/area-teams" element={<div className="page-stack narrow"><section className="panel empty-state"><h1>Equipos de atención</h1><p>Esta configuración se trasladó al Centro de control de Core.</p><a className="button" href="/dashboard?view=control-center&panel=ticket-teams">Abrir Core</a></section></div>} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
