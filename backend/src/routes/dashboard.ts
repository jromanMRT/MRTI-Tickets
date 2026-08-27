import { Router } from 'express';
import pool from '../config/db';
import { requireAuth } from '../middlewares/auth';
import { getTicketAreaScope } from '../services/ticketAreaAccess';

const router = Router();
const terminalStatuses = "'RESOLVED','CLOSED','CANCELLED'";

router.get('/summary', requireAuth, async (req, res) => {
  try {
    const scope = await getTicketAreaScope(req.user);
    const query = (sql: string) => pool.query(sql, scope.params);
    const [totalsResult, priorityResult, areaResult, workloadResult, recentResult, createdTrendResult, resolvedTrendResult] = await Promise.all([
      query(`SELECT COUNT(*) AS total,
        SUM(s.code NOT IN (${terminalStatuses})) AS \`open\`, SUM(s.code = 'NEW') AS new_count,
        SUM(s.code IN ('ASSIGNED','IN_DIAGNOSIS','IN_PROGRESS','REOPENED')) AS in_progress,
        SUM(s.code IN ('ON_HOLD_USER','ON_HOLD_VENDOR')) AS waiting,
        SUM(s.code = 'RESOLVED') AS resolved, SUM(s.code = 'CLOSED') AS closed,
        SUM(t.assigned_to IS NULL AND s.code NOT IN (${terminalStatuses})) AS unassigned,
        SUM(sp.id IS NOT NULL AND s.code NOT IN (${terminalStatuses}) AND DATE_ADD(t.created_at, INTERVAL sp.resolution_minutes MINUTE) < NOW()) AS overdue,
        SUM(sp.id IS NOT NULL AND s.code NOT IN (${terminalStatuses}) AND DATE_ADD(t.created_at, INTERVAL sp.resolution_minutes MINUTE) >= NOW()
          AND DATE_ADD(t.created_at, INTERVAL FLOOR(sp.resolution_minutes * .8) MINUTE) <= NOW()) AS at_risk,
        ROUND(AVG(CASE WHEN s.code NOT IN (${terminalStatuses}) THEN TIMESTAMPDIFF(MINUTE, t.created_at, NOW()) / 60 END), 1) AS average_open_age_hours
       FROM tickets t JOIN ticket_statuses s ON s.id = t.status_id
       LEFT JOIN ticket_categories c ON c.id = t.category_id LEFT JOIN sla_policies sp ON sp.id = t.sla_policy_id
       WHERE t.deleted_at IS NULL AND ${scope.sql}`),
      query(`SELECT t.priority_code AS code, COALESCE(p.name, t.priority_code) AS name, COUNT(*) AS count
       FROM tickets t JOIN ticket_statuses s ON s.id = t.status_id
       LEFT JOIN ticket_categories c ON c.id = t.category_id LEFT JOIN ticket_priorities p ON p.code = t.priority_code
       WHERE t.deleted_at IS NULL AND ${scope.sql} AND s.code NOT IN (${terminalStatuses})
       GROUP BY t.priority_code, p.name ORDER BY FIELD(t.priority_code, 'P1','P2','P3','P4')`),
      query(`SELECT b.id, COALESCE(b.name, 'Sin área') AS name, COUNT(*) AS \`open\`,
        SUM(sp.id IS NOT NULL AND DATE_ADD(t.created_at, INTERVAL sp.resolution_minutes MINUTE) < NOW()) AS overdue
       FROM tickets t JOIN ticket_statuses s ON s.id = t.status_id
       LEFT JOIN ticket_categories c ON c.id = t.category_id
       LEFT JOIN business_areas b ON b.id = COALESCE(t.business_area_id, c.business_area_id)
       LEFT JOIN sla_policies sp ON sp.id = t.sla_policy_id
       WHERE t.deleted_at IS NULL AND ${scope.sql} AND s.code NOT IN (${terminalStatuses})
       GROUP BY b.id, b.name ORDER BY \`open\` DESC, name`),
      query(`SELECT t.assigned_to AS id, COALESCE(t.assigned_to_name, 'Sin nombre') AS name,
        COUNT(*) AS \`open\`, SUM(t.priority_code IN ('P1','P2')) AS high_priority
       FROM tickets t JOIN ticket_statuses s ON s.id = t.status_id LEFT JOIN ticket_categories c ON c.id = t.category_id
       WHERE t.deleted_at IS NULL AND ${scope.sql} AND t.assigned_to IS NOT NULL AND s.code NOT IN (${terminalStatuses})
       GROUP BY t.assigned_to, t.assigned_to_name ORDER BY \`open\` DESC, name LIMIT 8`),
      query(`SELECT t.id, t.folio, t.title, t.priority_code, t.assigned_to_name, t.created_at, t.updated_at,
        s.code AS status_code, s.name AS status_name, COALESCE(b.name, 'Sin área') AS business_area_name,
        CASE WHEN sp.id IS NULL THEN 'none' WHEN DATE_ADD(t.created_at, INTERVAL sp.resolution_minutes MINUTE) < NOW() THEN 'overdue'
          WHEN DATE_ADD(t.created_at, INTERVAL FLOOR(sp.resolution_minutes * .8) MINUTE) <= NOW() THEN 'at_risk' ELSE 'on_track' END AS sla_state
       FROM tickets t JOIN ticket_statuses s ON s.id = t.status_id LEFT JOIN ticket_categories c ON c.id = t.category_id
       LEFT JOIN business_areas b ON b.id = COALESCE(t.business_area_id, c.business_area_id)
       LEFT JOIN sla_policies sp ON sp.id = t.sla_policy_id
       WHERE t.deleted_at IS NULL AND ${scope.sql} AND s.code NOT IN (${terminalStatuses})
       ORDER BY FIELD(s.code, 'NEW','REOPENED','OPEN','ASSIGNED','IN_DIAGNOSIS','IN_PROGRESS','ON_HOLD_USER','ON_HOLD_VENDOR'),
        FIELD(t.priority_code, 'P1','P2','P3','P4'), t.updated_at DESC LIMIT 8`),
      query(`SELECT DATE(t.created_at) AS day, COUNT(*) AS count FROM tickets t
       LEFT JOIN ticket_categories c ON c.id = t.category_id
       WHERE t.deleted_at IS NULL AND ${scope.sql} AND t.created_at >= CURDATE() - INTERVAL 6 DAY
       GROUP BY DATE(t.created_at) ORDER BY day`),
      query(`SELECT DATE(h.created_at) AS day, COUNT(DISTINCT h.ticket_id) AS count FROM ticket_status_history h
       JOIN tickets t ON t.id = h.ticket_id LEFT JOIN ticket_categories c ON c.id = t.category_id
       JOIN ticket_statuses s ON s.id = h.to_status_id
       WHERE t.deleted_at IS NULL AND ${scope.sql} AND s.code IN ('RESOLVED','CLOSED') AND h.created_at >= CURDATE() - INTERVAL 6 DAY
       GROUP BY DATE(h.created_at) ORDER BY day`),
    ]);
    const totals = (totalsResult[0] as any[])[0] || {};
    res.json({ success: true, data: {
      total: Number(totals.total || 0), open: Number(totals.open || 0), new: Number(totals.new_count || 0),
      inProgress: Number(totals.in_progress || 0), waiting: Number(totals.waiting || 0), resolved: Number(totals.resolved || 0),
      closed: Number(totals.closed || 0), unassigned: Number(totals.unassigned || 0), overdue: Number(totals.overdue || 0),
      atRisk: Number(totals.at_risk || 0), averageOpenAgeHours: Number(totals.average_open_age_hours || 0),
      byPriority: priorityResult[0], byArea: areaResult[0], workload: workloadResult[0], recent: recentResult[0],
      trend: { created: createdTrendResult[0], resolved: resolvedTrendResult[0] },
    } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'Error computing dashboard' } });
  }
});

export default router;
