import { Router } from 'express';
import pool from '../config/db';
import { requireAuth, requirePermission } from '../middlewares/auth';

const router = Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const clauses = ['1 = 1'];
    const params: Array<string | number> = [];
    if (req.query.category_id) {
      clauses.push('category_id = ?');
      params.push(String(req.query.category_id));
    }
    const [rows] = await pool.query(
      `SELECT id, category_id, name, code, active, sort_order
         FROM ticket_subcategories
        WHERE ${clauses.join(' AND ')}
        ORDER BY category_id, sort_order, name`,
      params
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error listing subcategories' } });
  }
});

router.post('/', requireAuth, requirePermission('Administrar categorías'), async (req, res) => {
  const { category_id, name, code, active, sort_order } = req.body;
  if (!category_id || !name || !code) {
    return res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'category_id, name y code son requeridos' } });
  }
  try {
    const [result]: any = await pool.query(
      'INSERT INTO ticket_subcategories (category_id, name, code, active, sort_order) VALUES (?,?,?,?,?)',
      [Number(category_id), name, code, active === false ? 0 : 1, sort_order || 100]
    );
    const [rows]: any = await pool.query(
      'SELECT id, category_id, name, code, active, sort_order FROM ticket_subcategories WHERE id = ? LIMIT 1',
      [result.insertId]
    );
    res.status(201).json({ success: true, data: rows[0], message: 'Subcategoría creada' });
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: err.message || 'Error creating subcategory' } });
  }
});

export default router;
