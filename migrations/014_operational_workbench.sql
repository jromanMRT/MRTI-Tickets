USE mrti_tickets;

-- Expansión aditiva para la mesa de trabajo. El escalamiento es una marca
-- operativa independiente del estado: no rompe el flujo vigente ni obliga a
-- traducir tickets históricos a un estado nuevo.
SET @col_escalated_at = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'tickets' AND column_name = 'escalated_at'
);
SET @sql_col_escalated_at = IF(
  @col_escalated_at = 0,
  'ALTER TABLE tickets ADD COLUMN escalated_at DATETIME NULL AFTER sla_deadline',
  'SELECT 1'
);
PREPARE stmt_col_escalated_at FROM @sql_col_escalated_at;
EXECUTE stmt_col_escalated_at;
DEALLOCATE PREPARE stmt_col_escalated_at;

SET @col_escalated_by = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'tickets' AND column_name = 'escalated_by'
);
SET @sql_col_escalated_by = IF(
  @col_escalated_by = 0,
  'ALTER TABLE tickets ADD COLUMN escalated_by VARCHAR(64) NULL AFTER escalated_at',
  'SELECT 1'
);
PREPARE stmt_col_escalated_by FROM @sql_col_escalated_by;
EXECUTE stmt_col_escalated_by;
DEALLOCATE PREPARE stmt_col_escalated_by;

SET @col_escalation_reason = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'tickets' AND column_name = 'escalation_reason'
);
SET @sql_col_escalation_reason = IF(
  @col_escalation_reason = 0,
  'ALTER TABLE tickets ADD COLUMN escalation_reason VARCHAR(500) NULL AFTER escalated_by',
  'SELECT 1'
);
PREPARE stmt_col_escalation_reason FROM @sql_col_escalation_reason;
EXECUTE stmt_col_escalation_reason;
DEALLOCATE PREPARE stmt_col_escalation_reason;

CREATE TABLE IF NOT EXISTS ticket_tags (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT 'stone',
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ticket_tags_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ticket_tag_links (
  ticket_id BIGINT NOT NULL,
  tag_id BIGINT UNSIGNED NOT NULL,
  created_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (ticket_id, tag_id),
  CONSTRAINT fk_ticket_tag_links_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id),
  CONSTRAINT fk_ticket_tag_links_tag FOREIGN KEY (tag_id) REFERENCES ticket_tags(id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ticket_relations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT NOT NULL,
  related_ticket_id BIGINT NOT NULL,
  relation_type VARCHAR(30) NOT NULL DEFAULT 'related',
  created_by VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_ticket_relation (ticket_id, related_ticket_id, relation_type),
  KEY idx_ticket_relations_related (related_ticket_id),
  CONSTRAINT fk_ticket_relations_ticket FOREIGN KEY (ticket_id) REFERENCES tickets(id),
  CONSTRAINT fk_ticket_relations_related FOREIGN KEY (related_ticket_id) REFERENCES tickets(id),
  CONSTRAINT chk_ticket_relation_distinct CHECK (ticket_id <> related_ticket_id)
) ENGINE=InnoDB;

SET @idx_escalated = (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'tickets' AND index_name = 'idx_tickets_escalated'
);
SET @sql_idx_escalated = IF(
  @idx_escalated = 0,
  'CREATE INDEX idx_tickets_escalated ON tickets(escalated_at)',
  'SELECT 1'
);
PREPARE stmt_idx_escalated FROM @sql_idx_escalated;
EXECUTE stmt_idx_escalated;
DEALLOCATE PREPARE stmt_idx_escalated;
