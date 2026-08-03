import pool from '../config/db';

export async function logAudit(actorId: string | number | null, actorName: string | null, action: string, entity: string, entityId: string | number | null, beforeJson: any = null, afterJson: any = null, ip?: string, userAgent?: string) {
  try {
    await pool.query('INSERT INTO audit_logs (actor_id, actor_name, action, entity, entity_id, before_json, after_json, ip_address, user_agent) VALUES (?,?,?,?,?,?,?,?,?)', [actorId, actorName, action, entity, entityId ? String(entityId) : null, beforeJson ? JSON.stringify(beforeJson) : null, afterJson ? JSON.stringify(afterJson) : null, ip || null, userAgent || null]);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Audit log failed', err);
  }
}
