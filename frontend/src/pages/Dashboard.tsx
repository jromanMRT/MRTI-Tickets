import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface Summary {
  total: number;
  open: number;
  resolved: number;
  closed: number;
  overdue: number;
  unassigned: number;
}

function Dashboard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard/summary')
      .then((res) => setSummary(res.data.data))
      .catch(() => setError('No se pudo cargar el dashboard'));
  }, []);

  if (error) return <div className="panel error">{error}</div>;
  if (!summary) return <div className="panel muted">Cargando dashboard…</div>;

  const cards = [
    ['Total', summary.total], ['Abiertos', summary.open], ['Resueltos', summary.resolved],
    ['Cerrados', summary.closed], ['Vencidos', summary.overdue], ['Sin asignar', summary.unassigned],
  ];

  return (
    <div className="page-stack">
      <div className="page-header">
        <div><p className="eyebrow">Mesa de servicio</p><h1>Dashboard</h1></div>
        <Link className="button" to="/tickets/new">Crear ticket</Link>
      </div>
      <div className="grid cards">
        {cards.map(([label, value]) => (
          <Link className="metric-card" to="/tickets" key={label}>
            <strong>{label}</strong><span>{value}</span>
          </Link>
        ))}
      </div>
      <div className="panel empty-state">
        <h2>Operación de soporte</h2>
        <p>Consulta solicitudes, actualiza su estado y conserva toda la conversación en un solo lugar.</p>
        <Link to="/tickets">Ver todos los tickets →</Link>
      </div>
    </div>
  );
}

export default Dashboard;
