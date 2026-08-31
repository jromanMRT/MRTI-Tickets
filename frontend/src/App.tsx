import { useEffect, useState } from 'react';
import { Route, Routes, NavLink, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
import NewTicket from './pages/NewTicket';
import api from './services/api';
import { useTheme } from './hooks/useTheme';
import { PortalNotifications } from './components/PortalNotifications';
import './style.css';
import './shell.css';

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('mrti_tickets_sidebar_collapsed') === '1');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [applications, setApplications] = useState<Array<{ code: string; name: string; url: string }>>([]);
  const [logoUrl, setLogoUrl] = useState('/company-logo.svg');
  const [theme, setTheme] = useTheme();
  const location = useLocation();
  let profile: { full_name?: string; role?: string } = {};
  try { profile = JSON.parse(localStorage.getItem('auth_profile') || '{}'); } catch { profile = {}; }
  const isAdministrator = profile.role === 'administrator';
  const routeTitle = location.pathname === '/'
    ? 'Resumen'
    : location.pathname === '/tickets/new'
      ? 'Nuevo ticket'
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

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) return;
    fetch('/api/portal/v1/applications', { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(({ data }) => setApplications(Array.isArray(data) ? data : []))
      .catch(() => setApplications([]));
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
          <a href="/" title="Volver al Core" className="brand"><span className="brand-mark"><img src={logoUrl} alt="" /></span><span className="brand-text"><strong>MRTI Tickets</strong><small>Volver a Mi espacio</small></span></a>
        </div>
        <nav>
          <NavLink to="/" end onClick={() => setMobileMenuOpen(false)}><span className="nav-icon" aria-hidden="true">⌂</span><span className="nav-label">Resumen</span></NavLink>
          <NavLink to="/tickets" onClick={() => setMobileMenuOpen(false)}><span className="nav-icon" aria-hidden="true">◇</span><span className="nav-label">Tickets</span></NavLink>
          <NavLink to="/tickets/new" onClick={() => setMobileMenuOpen(false)}><span className="nav-icon" aria-hidden="true">＋</span><span className="nav-label">Nuevo ticket</span></NavLink>
        </nav>
        <div className="module-switcher">
          <span className="module-switcher-label">Cambiar módulo</span>
          <a href="/" title="Mi espacio"><span className="nav-icon" aria-hidden="true">⌂</span><span className="nav-label">Mi espacio</span></a>
          {applications.filter((application) => application.code !== 'tickets').map((application) => <a key={application.code} href={application.code === 'agent-core' ? `${application.url}#token=${encodeURIComponent(localStorage.getItem('auth_token') || '')}&theme=${encodeURIComponent(localStorage.getItem('mrti_theme') || '')}` : application.url} title={application.name}><span className="nav-icon" aria-hidden="true">◆</span><span className="nav-label">{application.name}</span></a>)}
        </div>
        <div className="module-switcher">
          <span className="module-switcher-label">Mi cuenta</span>
          <a href="/?view=account" title="Perfil"><span className="nav-icon" aria-hidden="true">○</span><span className="nav-label">Perfil</span></a>
          {isAdministrator && <a href="/?view=brand-assets" title="Recursos de marca"><span className="nav-icon" aria-hidden="true">◆</span><span className="nav-label">Recursos de marca</span></a>}
          {isAdministrator && <a href="/?view=control-center" title="Centro de control"><span className="nav-icon" aria-hidden="true">⚙</span><span className="nav-label">Centro de control</span></a>}
        </div>
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
          <button type="button" className="icon-button sidebar-logout-button" onClick={handleLogout} title="Cerrar sesión" aria-label="Cerrar sesión">↪</button>
        </div>
      </aside>
      <main className="content">
        <header className="topbar">
          <button type="button" className="mobile-menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="Abrir navegación" aria-expanded={mobileMenuOpen} aria-controls="tickets-sidebar">☰</button>
          <span><strong>{routeTitle}</strong><small>MRTI Tickets</small></span>
          <div className="session-controls"><PortalNotifications /><a className="session-profile" href="/?view=account"><span className="session-avatar" aria-hidden="true">{(profile.full_name || 'Usuario').split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span><span><strong>{profile.full_name || 'Usuario'}</strong><small>{profile.role || 'Sesión activa'}</small></span></a></div>
        </header>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/tickets/new" element={<NewTicket />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/settings/area-teams" element={<div className="page-stack narrow"><section className="panel empty-state"><h1>Equipos de atención</h1><p>Esta configuración se trasladó al Centro de control de Core.</p><a className="button" href="/">Abrir Core</a></section></div>} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
