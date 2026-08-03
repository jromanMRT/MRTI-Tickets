import { Router } from 'express';
import pool from '../config/db';
import { requireAuth, requirePermission } from '../middlewares/auth';

const router = Router();

// Simple tickets report export
router.get('/tickets', requireAuth, requirePermission('Consultar reportes'), async (req, res) => {
  const { from, to, format } = req.query as any;
  const params: any[] = [];
  let where = 'WHERE 1=1';
  if (from) {
    where += ' AND t.created_at >= ?';
    params.push(from);
  }
  if (to) {
    where += ' AND t.created_at <= ?';
    params.push(to);
  }

  const sql = `SELECT t.id, t.folio, t.title, t.requester_name, t.requester_email, t.priority_code, s.code as status_code, t.created_at, t.updated_at FROM tickets t LEFT JOIN ticket_statuses s ON t.status_id = s.id ${where} ORDER BY t.created_at DESC`;
  try {
    const [rows]: any = await pool.query(sql, params);
    if (format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="tickets_report.csv"');
      const header = ['id','folio','title','requester_name','requester_email','priority_code','status_code','created_at','updated_at'];
      const lines = [header.join(',')].concat(rows.map((r: any) => header.map(h => (r[h] !== null && r[h] !== undefined) ? String(r[h]).replace(/\r?\n/g,' ') : '').map(v => `"${v.replace(/"/g,'""')}"`).join(',')));
      res.send(lines.join('\n'));
      return;
    }
    res.json({ success: true, data: rows });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error generating report' } });
  }
});

export default router;
