import { PermissionBoundary, useModulePermissions } from './vendor/mrti-platform/permission-ui.js';
import { useEffect, useRef, useState } from 'react';
import { Route, Routes, NavLink, useLocation } from 'react-router-dom';
import { User, Settings, Diamond, LogOut, Menu, ChevronDown } from 'lucide-react';
import { ModuleSidebar, SidebarGroup, SidebarNavIcon } from './components/layout/ModuleSidebar';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
import NewTicket from './pages/NewTicket';
import SlaPolicies from './pages/SlaPolicies';
import KnowledgeBase from './pages/KnowledgeBase';
import api from './services/api';
import { useTheme } from './hooks/useTheme';
import { PortalNotifications } from './components/PortalNotifications';
import { ModuleSwitcher } from './components/layout/ModuleSwitcher';
import { CommandPalette } from '@/components/CommandPalette';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import './style.css';
import './shell.css';

const NAV_ICON_PATHS: Record<string, JSX.Element> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V21h13V9.5M9 21v-7h6v7" /></>,
  tickets: <><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z" /><path d="M13 5v2M13 17v2M13 11v2" /></>,
  plus: <><path d="M12 5v14M5 12h14" /></>,
  book: <><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></>,
};

const NAV_ITEMS = [
  { to: '/', end: true, icon: 'home', label: 'Resumen', permission: '/' },
  { to: '/tickets', icon: 'tickets', label: 'Tickets', permission: '/tickets' },
  { to: '/tickets/new', icon: 'plus', label: 'Nuevo ticket', permission: '/tickets/new', method: 'POST' as const },
  { to: '/knowledge-base', icon: 'book', label: 'Base de conocimiento', permission: '/knowledge-base' },
];

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
      <Avatar className="h-[34px] w-[34px] text-[0.66rem] border-[1.5px] border-ore-400/30">{initials}</Avatar>
      <span className="account-identity"><strong>{name}</strong><small>{profile.role || 'Sesión activa'}</small></span>
      <span className="account-chevron" aria-hidden="true"><ChevronDown className="h-3.5 w-3.5" /></span>
    </button>
    {open && <div className="account-menu-panel" role="menu">
      <a href="/?view=account" role="menuitem"><span aria-hidden="true"><User className="h-4 w-4" /></span>Perfil</a>
      {profile.role === 'administrator' && <a href="/?view=brand-assets" role="menuitem"><span aria-hidden="true"><Diamond className="h-4 w-4" /></span>Recursos de marca</a>}
      {profile.role === 'administrator' && <a href="/?view=control-center" role="menuitem"><span aria-hidden="true"><Settings className="h-4 w-4" /></span>Centro de control</a>}
      <button type="button" className="account-menu-logout" onClick={onLogout} role="menuitem"><span aria-hidden="true"><LogOut className="h-4 w-4" /></span>Cerrar sesión</button>
    </div>}
  </div>;
}

function App() {
  const permissions = useModulePermissions('tickets');
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('mrti_sidebar_collapsed') === '1');

  // Releer al recuperar una página y cuando otra pestaña cambia la preferencia.
  useEffect(() => {
    const syncSidebar = () => setCollapsed(localStorage.getItem('mrti_sidebar_collapsed') === '1');
    syncSidebar();
    window.addEventListener('storage', syncSidebar);
    window.addEventListener('focus', syncSidebar);
    window.addEventListener('pageshow', syncSidebar);
    document.addEventListener('visibilitychange', syncSidebar);
    return () => {
      window.removeEventListener('storage', syncSidebar);
      window.removeEventListener('focus', syncSidebar);
      window.removeEventListener('pageshow', syncSidebar);
      document.removeEventListener('visibilitychange', syncSidebar);
    };
  }, []);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const location = useLocation();
  let profile: { full_name?: string; role?: string } = {};
  try { profile = JSON.parse(localStorage.getItem('auth_profile') || '{}'); } catch { profile = {}; }
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
      localStorage.setItem('mrti_sidebar_collapsed', prev ? '0' : '1');
      return !prev;
    });
  }

  return (
    <div className={`app-shell${collapsed ? ' sidebar-collapsed' : ''}${mobileMenuOpen ? ' mobile-menu-open' : ''}`}>
      <CommandPalette permissions={permissions} profile={profile} />
      <button className="sidebar-backdrop" type="button" onClick={() => setMobileMenuOpen(false)} aria-label="Cerrar navegación" />
      <ModuleSidebar moduleLabel="Tickets" collapsed={collapsed} mobileOpen={mobileMenuOpen} onToggleCollapse={toggleCollapse} onThemeToggle={() => setTheme(theme === 'dark' ? 'light' : 'dark')} theme={theme}>
        <SidebarGroup>
          {NAV_ITEMS.map((item) => {
            const method = item.method || 'GET';
            if (!permissions.can(item.permission, method)) return null;
            return (
              <li key={item.to}>
                <NavLink to={item.to} end={item.end} onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `portal-module-nav-item${isActive ? ' is-active' : ''}`}>
                  {({ isActive }) => (<>
                    <SidebarNavIcon>{NAV_ICON_PATHS[item.icon]}</SidebarNavIcon>
                    <span className="portal-module-nav-label">{item.label}</span>
                    {isActive && <span className="portal-module-nav-dot" />}
                  </>)}
                </NavLink>
              </li>
            );
          })}
          {profile.role === 'administrator' && (
            <li>
              <NavLink to="/settings/sla-policies" onClick={() => setMobileMenuOpen(false)} className={({ isActive }) => `portal-module-nav-item${isActive ? ' is-active' : ''}`}>
                {({ isActive }) => (<>
                  <SidebarNavIcon>{NAV_ICON_PATHS.clock}</SidebarNavIcon>
                  <span className="portal-module-nav-label">Políticas de SLA</span>
                  {isActive && <span className="portal-module-nav-dot" />}
                </>)}
              </NavLink>
            </li>
          )}
        </SidebarGroup>
      </ModuleSidebar>
      <main className="content">
        <header className="topbar mrti-global-header">
          <button type="button" className="mobile-menu-button" onClick={() => setMobileMenuOpen(true)} aria-label="Abrir navegación" aria-expanded={mobileMenuOpen} aria-controls="tickets-sidebar"><Menu className="h-[18px] w-[18px]" /></button>
          <ModuleSwitcher moduleCode="tickets" />
          <div className="session-controls"><PortalNotifications /><AccountMenu profile={profile} onLogout={() => void handleLogout()} /></div>
        </header>
        <PermissionBoundary code="tickets"><div key={location.pathname} className="page-enter"><Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/tickets/new" element={<NewTicket />} />
          <Route path="/knowledge-base" element={<KnowledgeBase />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
          <Route path="/settings/sla-policies" element={<SlaPolicies />} />
          <Route path="/settings/area-teams" element={<div className="mx-auto grid max-w-[920px] gap-6"><section className="rounded-2xl border border-stone-200 bg-white p-8 text-center shadow-sm dark:border-stone-600 dark:bg-stone-800"><h1 className="text-xl font-bold text-stone-900 dark:text-stone-50">Equipos de atención</h1><p className="mt-2 text-sm text-stone-400">Esta configuración se trasladó al Centro de control de Core.</p><Button className="mt-4" asChild><a href="/dashboard?view=control-center&panel=ticket-teams">Abrir Core</a></Button></section></div>} />
        </Routes></div></PermissionBoundary>
      </main>
    </div>
  );
}

export default App;
