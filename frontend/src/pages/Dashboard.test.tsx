import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Dashboard from './Dashboard';
import api from '../services/api';

vi.mock('../services/api', () => ({ default: { get: vi.fn() } }));

test('presenta indicadores y colas de una mesa de servicio empresarial', async () => {
  vi.mocked(api.get).mockResolvedValueOnce({
    data: {
      data: {
        total: 12, open: 7, new: 2, inProgress: 3, waiting: 2, resolved: 4, closed: 1,
        overdue: 1, atRisk: 2, unassigned: 3, averageOpenAgeHours: 6.5,
        byPriority: [], byArea: [], workload: [], recent: [], trend: { created: [], resolved: [] },
      },
    },
  });

  render(<BrowserRouter><Dashboard /></BrowserRouter>);

  expect(await screen.findByRole('heading', { name: 'Centro operativo' })).toBeInTheDocument();
  expect(screen.getByText('Trabajo activo')).toBeInTheDocument();
  expect(screen.getByText('Mis asignados')).toBeInTheDocument();
  expect(screen.getAllByText('SLA vencido')).toHaveLength(2);
});
