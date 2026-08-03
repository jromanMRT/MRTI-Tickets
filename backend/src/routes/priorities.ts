import { Router } from 'express';
import pool from '../config/db';
import { requireAuth, requirePermission } from '../middlewares/auth';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT code, name, level FROM ticket_priorities ORDER BY level');
    res.json({ success: true, data: rows });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error listing priorities' } });
  }
});

router.post('/', requireAuth, requirePermission('Administrar prioridades'), async (req, res) => {
  const { code, name, level } = req.body;
  if (!code || !name || typeof level !== 'number') return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'code, name and level required' } });
  try {
    await pool.query('INSERT INTO ticket_priorities (code, name, level) VALUES (?,?,?)', [code, name, level]);
    res.status(201).json({ success: true, message: 'Prioridad creada' });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message || 'Error creating priority' } });
  }
});

export default router;
