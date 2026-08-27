import { NextFunction, Request, Response } from 'express';
import pool from '../config/db';

export function isGlobalTicketAdministrator(user: any): boolean {
  const roles = [user?.role, ...(Array.isArray(user?.roles) ? user.roles : [])]
    .map((role) => String(role || '').trim().toLowerCase());
  return roles.some((role) => role === 'administrator' || role === 'administrador');
}

export async function getTicketAreaScope(user: any, ticketAlias = 't', categoryAlias = 'c') {
  if (isGlobalTicketAdministrator(user)) return { sql: '1 = 1', params: [] as string[] };
  const userId = String(user?.id || '');
  return {
    sql: `COALESCE(${ticketAlias}.business_area_id, ${categoryAlias}.business_area_id) IN
      (SELECT bam.business_area_id FROM business_area_members bam WHERE bam.user_id = ?)`,
    params: [userId],
  };
}

export async function canAccessTicket(user: any, ticketId: number): Promise<'allowed' | 'forbidden' | 'missing'> {
  const [tickets]: any = await pool.query(
    `SELECT COALESCE(t.business_area_id, c.business_area_id) AS business_area_id
       FROM tickets t
       LEFT JOIN ticket_categories c ON c.id = t.category_id
      WHERE t.id = ? AND t.deleted_at IS NULL LIMIT 1`,
    [ticketId]
  );
  if (!tickets.length) return 'missing';
  if (isGlobalTicketAdministrator(user)) return 'allowed';
  const areaId = tickets[0].business_area_id;
  if (!areaId || !user?.id) return 'forbidden';
  const [members]: any = await pool.query(
    'SELECT 1 FROM business_area_members WHERE business_area_id = ? AND user_id = ? LIMIT 1',
    [areaId, user.id]
  );
  return members.length ? 'allowed' : 'forbidden';
}

export async function requireTicketAreaAccess(req: Request, res: Response, next: NextFunction) {
  const ticketId = Number(req.params.id);
  if (!Number.isInteger(ticketId) || ticketId < 1) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_TICKET', message: 'Ticket inválido' } });
  }
  try {
    const access = await canAccessTicket(req.user, ticketId);
    if (access === 'missing') {
      return res.status(404).json({ success: false, error: { code: 'TICKET_NOT_FOUND', message: 'No se encontró el ticket' } });
    }
    if (access === 'forbidden') {
      return res.status(403).json({ success: false, error: { code: 'AREA_FORBIDDEN', message: 'Este ticket pertenece a otra área de atención' } });
    }
    return next();
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, error: { code: 'DB_ERROR', message: 'No se pudo validar el área del ticket' } });
  }
}

export async function validateTicketClassification(areaId: number, categoryId: number, subcategoryId?: number | null) {
  const [categories]: any = await pool.query(
    `SELECT id FROM ticket_categories
      WHERE id = ? AND business_area_id = ? AND active = 1 LIMIT 1`,
    [categoryId, areaId]
  );
  if (!categories.length) return { valid: false, code: 'INVALID_CATEGORY', message: 'La categoría no pertenece al área seleccionada' };
  if (subcategoryId) {
    const [subcategories]: any = await pool.query(
      `SELECT id FROM ticket_subcategories
        WHERE id = ? AND category_id = ? AND active = 1 LIMIT 1`,
      [subcategoryId, categoryId]
    );
    if (!subcategories.length) return { valid: false, code: 'INVALID_SUBCATEGORY', message: 'El detalle no pertenece a la categoría seleccionada' };
  }
  return { valid: true };
}
