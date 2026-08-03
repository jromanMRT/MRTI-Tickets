import { Router } from 'express';
import pool from '../config/db';
import { requireAuth } from '../middlewares/auth';

const router = Router();

router.get('/summary', requireAuth, async (req, res) => {
  try {
    const [[{ total }]]: any = await pool.query('SELECT COUNT(*) as total FROM tickets');
    const [[{ open_count }]]: any = await pool.query("SELECT COUNT(*) as open_count FROM tickets t JOIN ticket_statuses s ON t.status_id = s.id WHERE s.code NOT IN ('RESOLVED','CLOSED','CANCELLED')");
    const [[{ resolved }]]: any = await pool.query("SELECT COUNT(*) as resolved FROM tickets t JOIN ticket_statuses s ON t.status_id = s.id WHERE s.code = 'RESOLVED'");
    const [[{ closed }]]: any = await pool.query("SELECT COUNT(*) as closed FROM tickets t JOIN ticket_statuses s ON t.status_id = s.id WHERE s.code = 'CLOSED'");
    const [[{ unassigned }]]: any = await pool.query('SELECT COUNT(*) as unassigned FROM tickets WHERE assigned_to IS NULL');

    const [byPriority]: any = await pool.query('SELECT priority_code, COUNT(*) as count FROM tickets GROUP BY priority_code');

    // overdue: compare created_at + resolution_minutes
    const [[{ overdue }]]: any = await pool.query("SELECT COUNT(*) as overdue FROM tickets t JOIN sla_policies sp ON t.sla_policy_id = sp.id JOIN ticket_statuses s ON t.status_id = s.id WHERE s.code NOT IN ('RESOLVED','CLOSED') AND DATE_ADD(t.created_at, INTERVAL sp.resolution_minutes MINUTE) < NOW()");

    res.json({ success: true, data: { total, open: open_count, resolved, closed, unassigned, overdue, byPriority } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error computing dashboard' } });
  }
});

export default router;
