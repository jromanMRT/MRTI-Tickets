import { Router } from 'express';
import pool from '../config/db';
import { requireAuth, requirePermission } from '../middlewares/auth';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, code, name, description, is_system, sort_order FROM ticket_statuses ORDER BY sort_order');
    res.json({ success: true, data: rows });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error listing statuses' } });
  }
});

router.post('/', requireAuth, requirePermission('Administrar estados'), async (req, res) => {
  const { code, name, description, is_system, sort_order } = req.body;
  if (!code || !name) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'code and name required' } });
  try {
    const [result]: any = await pool.query('INSERT INTO ticket_statuses (code, name, description, is_system, sort_order) VALUES (?,?,?,?,?)', [code, name, description || null, is_system ? 1 : 0, sort_order || 100]);
    const [rows]: any = await pool.query('SELECT id, code, name, description, is_system, sort_order FROM ticket_statuses WHERE id = ? LIMIT 1', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0], message: 'Estado creado' });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message || 'Error creating status' } });
  }
});

export default router;
