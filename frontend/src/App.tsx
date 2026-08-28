import { useEffect, useState } from 'react';
import { Route, Routes, NavLink, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
import NewTicket from './pages/NewTicket';
import AreaTeams from './pages/AreaTeams';
import api from './services/api';
import { useTheme } from './hooks/useTheme';
import './style.css';
import './shell.css';

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('mrti_tickets_sidebar_collapsed') === '1');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const location = useLocation();
  let profile: { full_name?: string; role?: string } = {};
  try { profile = JSON.parse(localStorage.getItem('auth_profile') || '{}'); } catch { profile = {}; }

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

  useEffect(() => setMobileMenuOpen(false), [location.pathname]);

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
          <div className="brand"><span className="brand-text">MRTI-Tickets</span></div>
          <a href="/">← Core</a>
        </div>
        <nav>
          <NavLink to="/" end onClick={() => setMobileMenuOpen(false)}><span className="nav-icon" aria-hidden="true">⌂</span><span className="nav-label">Resumen</span></NavLink>
          <NavLink to="/tickets" onClick={() => setMobileMenuOpen(false)}><span className="nav-icon" aria-hidden="true">◇</span><span className="nav-label">Tickets</span></NavLink>
          <NavLink to="/tickets/new" onClick={() => setMobileMenuOpen(false)}><span className="nav-icon" aria-hidden="true">＋</span><span className="nav-label">Nuevo ticket</span></NavLink>
          {profile.role === 'administrator' && <NavLink to="/settings/area-teams" onClick={() => setMobileMenuOpen(false)}><span className="nav-icon" aria-hidden="true">♙</span><span className="nav-label">Equipos por área</span></NavLink>}
        </nav>
        <div className="sidebar-footer">
          <button
            type="button"
            className="icon-button"
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
          <span><strong>MRTI-Tickets</strong><small>Tickets y seguimiento</small></span>
          <div className="session-controls"><span><strong>{profile.full_name || 'Usuario'}</strong><small>{profile.role || 'Sesión activa'}</small></span><button className="logout" onClick={() => { localStorage.removeItem('auth_token'); localStorage.removeItem('auth_profile'); window.location.replace('/'); }}>Cerrar sesión</button></div>
        </header>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/tickets/new" element={<NewTicket />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/settings/area-teams" element={<AreaTeams />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
