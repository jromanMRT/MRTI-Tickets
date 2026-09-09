import pool from '../config/db';
import { TERMINAL_TICKET_STATUS_CODES_SQL, slaStateCaseSql } from './slaSql';

export async function listTeamTicketNotifications(userId: string, limit = 10) {
  const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);
  const [rows]: any = await pool.query(
    `SELECT t.id, t.folio, t.title, t.created_at, t.updated_at,
            s.code AS status_code, s.name AS status_name,
            p.name AS priority_name,
            COALESCE(t.business_area_id, c.business_area_id) AS business_area_id,
            b.name AS business_area_name,
            ${slaStateCaseSql(TERMINAL_TICKET_STATUS_CODES_SQL)} AS sla_state
       FROM tickets t
       JOIN ticket_statuses s ON s.id = t.status_id
       LEFT JOIN ticket_priorities p ON p.code = t.priority_code
       LEFT JOIN ticket_categories c ON c.id = t.category_id
       LEFT JOIN business_areas b ON b.id = COALESCE(t.business_area_id, c.business_area_id)
       LEFT JOIN sla_policies sp ON sp.id = t.sla_policy_id
      WHERE t.deleted_at IS NULL
        AND t.assigned_to IS NULL
        AND s.code NOT IN ('RESOLVED', 'CLOSED', 'CANCELLED')
        AND EXISTS (
          SELECT 1 FROM business_area_members bam
           WHERE bam.business_area_id = COALESCE(t.business_area_id, c.business_area_id)
             AND bam.user_id = ?
        )
      ORDER BY t.created_at DESC
      LIMIT ?`,
    [userId, safeLimit]
  );
  return rows;
}
