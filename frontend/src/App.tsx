import { useEffect, useState } from 'react';
import { Route, Routes, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Tickets from './pages/Tickets';
import TicketDetail from './pages/TicketDetail';
import NewTicket from './pages/NewTicket';
import api from './services/api';
import './style.css';

function App() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
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

  if (checkingSession) return <main className="login-shell"><div className="login-card">Validando sesión…</div></main>;

  if (!authenticated) {
    const returnTo = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(`/?returnTo=${encodeURIComponent(returnTo)}`);
    return <main className="login-shell"><div className="login-card">Redirigiendo al acceso central…</div></main>;
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-row"><div className="brand">MRTI Tickets</div><a href="/">← Core</a></div>
        <nav>
          <NavLink to="/" end>Dashboard</NavLink>
          <NavLink to="/tickets">Tickets</NavLink>
        </nav>
      </aside>
      <main className="content">
        <header className="topbar">
          <span>MRTI Tickets</span>
          <div className="session-controls"><span><strong>{profile.full_name || 'Usuario'}</strong><small>{profile.role || 'Sesión activa'}</small></span><button className="logout" onClick={() => { localStorage.removeItem('auth_token'); localStorage.removeItem('auth_profile'); window.location.replace('/'); }}>Cerrar sesión</button></div>
        </header>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tickets" element={<Tickets />} />
          <Route path="/tickets/new" element={<NewTicket />} />
          <Route path="/tickets/:id" element={<TicketDetail />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
