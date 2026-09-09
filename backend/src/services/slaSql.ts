// Fragmentos SQL de SLA compartidos por tickets.ts, dashboard.ts,
// ticketsSelf.ts y teamNotifications.ts. Antes cada ruta traía su propia
// copia de la expresión "vencido/en riesgo" (cuatro copias distintas) sin
// que ninguna considerara una pausa -- un ticket en espera del usuario o de
// un proveedor se contaba como vencido igual que uno abandonado. Mantener
// la expresión en un solo lugar es lo que permite que sea correcta en las
// cuatro rutas a la vez.
//
// Requiere que la consulta use los alias `t` (tickets) y `sp` (sla_policies,
// LEFT JOIN sp ON sp.id = t.sla_policy_id) -- igual que ya hacían todas las
// consultas existentes.
// Única fuente de verdad para "estado terminal": antes tickets.ts y
// dashboard.ts repetían este literal (consistentes entre sí) mientras
// slaService.ts, en JS, sólo revisaba RESOLVED/CLOSED -- un ticket
// CANCELLED mostraba "Pausado" o "Vencido" en /tickets/:id/sla-status en
// vez de "Cumplido", aunque la lista y el dashboard sí lo mostraban bien.
export const TERMINAL_TICKET_STATUS_CODES = ['RESOLVED', 'CLOSED', 'CANCELLED'] as const;
export const TERMINAL_TICKET_STATUS_CODES_SQL = TERMINAL_TICKET_STATUS_CODES.map((code) => `'${code}'`).join(',');

export const SLA_LIVE_PAUSED_MINUTES_SQL =
  '(t.sla_paused_minutes + IF(t.sla_paused_since IS NOT NULL, GREATEST(TIMESTAMPDIFF(MINUTE, t.sla_paused_since, NOW()), 0), 0))';

export const SLA_DEADLINE_SQL =
  `DATE_ADD(t.created_at, INTERVAL (sp.resolution_minutes + ${SLA_LIVE_PAUSED_MINUTES_SQL}) MINUTE)`;

export const SLA_AT_RISK_FROM_SQL =
  `DATE_ADD(t.created_at, INTERVAL (FLOOR(sp.resolution_minutes * 0.8) + ${SLA_LIVE_PAUSED_MINUTES_SQL}) MINUTE)`;

/** CASE SQL que clasifica el estado de SLA de un ticket: 'completed' | 'none' | 'paused' | 'overdue' | 'at_risk' | 'on_track'. */
export function slaStateCaseSql(terminalStatusCodesSql: string): string {
  return `CASE
    WHEN s.code IN (${terminalStatusCodesSql}) THEN 'completed'
    WHEN sp.id IS NULL THEN 'none'
    WHEN t.sla_paused_since IS NOT NULL THEN 'paused'
    WHEN ${SLA_DEADLINE_SQL} < NOW() THEN 'overdue'
    WHEN ${SLA_AT_RISK_FROM_SQL} <= NOW() THEN 'at_risk'
    ELSE 'on_track'
  END`;
}

/** Condición booleana: el ticket está vencido ahora mismo (no aplica si está pausado). */
export function slaIsOverdueSql(): string {
  return `sp.id IS NOT NULL AND t.sla_paused_since IS NULL AND ${SLA_DEADLINE_SQL} < NOW()`;
}

/** Condición booleana: el ticket está en riesgo ahora mismo (no aplica si está pausado). */
export function slaIsAtRiskSql(): string {
  return `sp.id IS NOT NULL AND t.sla_paused_since IS NULL AND ${SLA_DEADLINE_SQL} >= NOW() AND ${SLA_AT_RISK_FROM_SQL} <= NOW()`;
}
