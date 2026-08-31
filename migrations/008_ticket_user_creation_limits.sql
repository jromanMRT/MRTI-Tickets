USE mrti_tickets;

-- Política por UUID de Core. No hay FK entre módulos: Tickets conserva sólo
-- la referencia estable del usuario cuya creación se controla.
CREATE TABLE IF NOT EXISTS ticket_user_creation_limits (
  user_id VARCHAR(64) PRIMARY KEY,
  hourly_limit INT UNSIGNED NULL,
  daily_limit INT UNSIGNED NULL,
  creation_blocked BOOLEAN NOT NULL DEFAULT FALSE,
  updated_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

SET @has_requester_created_index = (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE()
     AND table_name = 'tickets'
     AND index_name = 'idx_tickets_requester_created'
);
SET @requester_created_index_sql = IF(
  @has_requester_created_index = 0,
  'CREATE INDEX idx_tickets_requester_created ON tickets(requester_id, created_at)',
  'SELECT 1'
);
PREPARE requester_created_index_stmt FROM @requester_created_index_sql;
EXECUTE requester_created_index_stmt;
DEALLOCATE PREPARE requester_created_index_stmt;
