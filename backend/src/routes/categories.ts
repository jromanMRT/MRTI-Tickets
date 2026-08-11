import { Router } from 'express';
import pool from '../config/db';
import { requireAuth, requirePermission } from '../middlewares/auth';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT c.id, c.name, c.code, c.active, c.sort_order, c.business_area_id, b.name AS business_area_name
         FROM ticket_categories c
         LEFT JOIN business_areas b ON b.id = c.business_area_id
        ORDER BY b.sort_order, c.sort_order, c.name`
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error listing categories' } });
  }
});

router.post('/', requireAuth, requirePermission('Administrar categorías'), async (req, res) => {
  const { name, code, active, sort_order, business_area_id } = req.body;
  if (!name || !code) return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'name and code required' } });
  try {
    const [result]: any = await pool.query(
      'INSERT INTO ticket_categories (name, code, active, sort_order, business_area_id) VALUES (?,?,?,?,?)',
      [name, code, active === false ? 0 : 1, sort_order || 100, business_area_id || null]
    );
    const [rows]: any = await pool.query('SELECT id, name, code, active, sort_order, business_area_id FROM ticket_categories WHERE id = ? LIMIT 1', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0], message: 'Categoría creada' });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message || 'Error creating category' } });
  }
});

export default router;
