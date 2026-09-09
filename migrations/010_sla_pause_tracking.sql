USE mrti_tickets;

-- El reloj de SLA no debe correr mientras el ticket espera al usuario o a un
-- proveedor externo (estados ON_HOLD_USER/ON_HOLD_VENDOR): hoy sí corre, lo
-- que marca como "vencido" un ticket que en realidad espera una respuesta
-- ajena al equipo. sla_paused_minutes acumula el tiempo ya pausado
-- (confirmado al reanudar); sla_paused_since marca una pausa en curso -- se
-- suma en vivo en las consultas, nunca se deja crecer sin control.
SET @has_paused_minutes = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'tickets' AND column_name = 'sla_paused_minutes'
);
SET @paused_minutes_sql = IF(@has_paused_minutes = 0,
  'ALTER TABLE tickets ADD COLUMN sla_paused_minutes INT UNSIGNED NOT NULL DEFAULT 0 AFTER sla_deadline',
  'SELECT 1');
PREPARE paused_minutes_stmt FROM @paused_minutes_sql;
EXECUTE paused_minutes_stmt;
DEALLOCATE PREPARE paused_minutes_stmt;

SET @has_paused_since = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'tickets' AND column_name = 'sla_paused_since'
);
SET @paused_since_sql = IF(@has_paused_since = 0,
  'ALTER TABLE tickets ADD COLUMN sla_paused_since DATETIME NULL AFTER sla_paused_minutes',
  'SELECT 1');
PREPARE paused_since_stmt FROM @paused_since_sql;
EXECUTE paused_since_stmt;
DEALLOCATE PREPARE paused_since_stmt;

-- Backfill: un ticket que hoy está en espera se marca pausado desde que
-- entró por última vez a ese estado (visto en su propio historial), no
-- desde su creación -- así no se le regala tiempo que sí transcurrió en
-- atención activa. Idempotente: sólo toca los que aún no tienen la marca.
UPDATE tickets t
JOIN ticket_statuses s ON s.id = t.status_id
JOIN (
  SELECT h.ticket_id, MAX(h.created_at) AS became_paused_at
    FROM ticket_status_history h
    JOIN ticket_statuses ts ON ts.id = h.to_status_id
   WHERE ts.code IN ('ON_HOLD_USER', 'ON_HOLD_VENDOR')
   GROUP BY h.ticket_id
) latest_pause ON latest_pause.ticket_id = t.id
   SET t.sla_paused_since = latest_pause.became_paused_at
 WHERE s.code IN ('ON_HOLD_USER', 'ON_HOLD_VENDOR') AND t.sla_paused_since IS NULL;
