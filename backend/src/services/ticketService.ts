import pool from '../config/db';
import { buildFolio } from './folio';
import { randomUUID } from 'crypto';
import { SLA_POLICY_RESOLUTION_SQL } from './slaSql';

export async function createTicket(data: {
  title: string;
  description?: string | null;
  business_area_id: number;
  category_id?: number | null;
  subcategory_id?: number | null;
  categories?: Array<{ category_id: number; subcategory_id: number | null }>;
  related_device_id?: string | null;
  asset_number?: string | null;
  asset_uid?: string | null;
  priority_code?: string | null;
  requester_id?: string | null;
  requester_name?: string | null;
  requester_email?: string | null;
  requester_number?: number | null;
  origin_site_id?: string | null;
  origin_site_name?: string | null;
  origin_building_name?: string | null;
  origin_floor_name?: string | null;
  origin_area_id?: string | null;
  origin_area_name?: string | null;
  requester_device_id?: string | null;
  requester_device_internal_id?: string | null;
  requester_device_name?: string | null;
  affected_device_internal_id?: string | null;
  affected_device_name?: string | null;
  created_by?: string | null;
  sla_policy_id?: number | null;
}) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [statusRows]: any = await connection.query('SELECT id FROM ticket_statuses WHERE code = ? LIMIT 1', ['NEW']);
    const statusId = statusRows[0]?.id || 1;

    let slaPolicyId = data.sla_policy_id || null;
    if (!slaPolicyId && data.priority_code) {
      const [slaRows]: any = await connection.query(SLA_POLICY_RESOLUTION_SQL, [
        data.priority_code, data.category_id || null, data.business_area_id || null,
      ]);
      slaPolicyId = slaRows[0]?.id || null;
    }

    const pendingFolio = `PENDING-${randomUUID()}`;
    const [insertResult]: any = await connection.query(
      `INSERT INTO tickets
        (folio, title, description, requester_id, requester_name, requester_email,
         requester_number, category_id, subcategory_id, related_device_id, asset_number, asset_uid,
         requester_device_id, requester_device_internal_id, requester_device_name,
         affected_device_internal_id, affected_device_name,
         origin_site_id, origin_site_name, origin_building_name, origin_floor_name,
         origin_area_id, origin_area_name, business_area_id, priority_code, assigned_to, created_by,
         status_id, sla_policy_id)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        pendingFolio,
        data.title,
        data.description || null,
        data.requester_id || null,
        data.requester_name || null,
        data.requester_email || null,
        data.requester_number || null,
        data.category_id || null,
        data.subcategory_id || null,
        data.related_device_id || null,
        data.asset_number || null,
        data.asset_uid || null,
        data.requester_device_id || null,
        data.requester_device_internal_id || null,
        data.requester_device_name || null,
        data.affected_device_internal_id || null,
        data.affected_device_name || null,
        data.origin_site_id || null,
        data.origin_site_name || null,
        data.origin_building_name || null,
        data.origin_floor_name || null,
        data.origin_area_id || null,
        data.origin_area_name || null,
        data.business_area_id,
        data.priority_code || 'P3',
        null,
        data.created_by || null,
        statusId,
        slaPolicyId,
      ]
    );

    const ticketId = insertResult.insertId;
    const year = new Date().getFullYear();
    const folio = buildFolio(year, ticketId);
    await connection.query('UPDATE tickets SET folio = ? WHERE id = ?', [folio, ticketId]);

    if (data.categories && data.categories.length) {
      const values = data.categories.map((item) => [ticketId, item.category_id, item.subcategory_id || null]);
      await connection.query('INSERT INTO ticket_category_links (ticket_id, category_id, subcategory_id) VALUES ?', [values]);
    }
    await connection.query('INSERT INTO ticket_status_history (ticket_id, from_status_id, to_status_id, changed_by, comment) VALUES (?,?,?,?,?)', [ticketId, null, statusId, data.created_by || null, 'Ticket creado']);
    await connection.commit();

    const [ticketRows]: any = await connection.query('SELECT id, folio, title, status_id, created_at FROM tickets WHERE id = ? LIMIT 1', [ticketId]);
    return ticketRows[0];
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}
