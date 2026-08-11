import { Router } from 'express';
import pool from '../config/db';
import { requireAuth, requirePermission } from '../middlewares/auth';

const router = Router();

router.get('/', requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, code, sort_order FROM business_areas WHERE active = 1 ORDER BY sort_order, name');
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error listing business areas' } });
  }
});

router.get('/:id/members', requireAuth, requirePermission('Administrar categorías'), async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT user_id, user_name, created_at FROM business_area_members WHERE business_area_id = ? ORDER BY user_name',
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error listing area members' } });
  }
});

router.post('/:id/members', requireAuth, requirePermission('Administrar categorías'), async (req, res) => {
  const { user_id, user_name } = req.body || {};
  if (!user_id) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'user_id es requerido' } });
  try {
    await pool.query(
      'INSERT INTO business_area_members (business_area_id, user_id, user_name) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE user_name = VALUES(user_name)',
      [req.params.id, user_id, user_name || null]
    );
    res.status(201).json({ success: true, message: 'Miembro agregado' });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message || 'Error adding member' } });
  }
});

router.delete('/:id/members/:userId', requireAuth, requirePermission('Administrar categorías'), async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM business_area_members WHERE business_area_id = ? AND user_id = ?',
      [req.params.id, req.params.userId]
    );
    res.json({ success: true, message: 'Miembro eliminado' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error removing member' } });
  }
});

export default router;
