-- Initial migration for MRTI-Tickets
-- Use a dedicated database `mrti_tickets`

CREATE DATABASE IF NOT EXISTS mrti_tickets CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE mrti_tickets;

-- Ticket statuses
CREATE TABLE IF NOT EXISTS ticket_statuses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(50) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 100,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Tickets
CREATE TABLE IF NOT EXISTS tickets (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  folio VARCHAR(50) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  requester_id BIGINT NULL,
  requester_name VARCHAR(255) NULL,
  requester_email VARCHAR(255) NULL,
  department VARCHAR(128) NULL,
  site VARCHAR(128) NULL,
  category_id INT NULL,
  subcategory_id INT NULL,
  type VARCHAR(64) NULL,
  impact VARCHAR(32) NULL,
  urgency VARCHAR(32) NULL,
  priority_code VARCHAR(16) NULL,
  related_device_id BIGINT NULL,
  asset_number VARCHAR(64) NULL,
  assigned_to BIGINT NULL,
  created_by BIGINT NULL,
  status_id INT NOT NULL,
  sla_policy_id INT NULL,
  sla_deadline DATETIME NULL,
  metadata JSON NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL
);

-- Status history
CREATE TABLE IF NOT EXISTS ticket_status_history (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT NOT NULL,
  from_status_id INT NULL,
  to_status_id INT NOT NULL,
  changed_by BIGINT NULL,
  comment TEXT,
  reason VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);

-- Categories and subcategories
CREATE TABLE IF NOT EXISTS ticket_categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(100) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 100,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ticket_subcategories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  category_id INT NOT NULL,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(100) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 100,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES ticket_categories(id)
);

-- Priorities table
CREATE TABLE IF NOT EXISTS ticket_priorities (
  code VARCHAR(10) PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  level INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Comments
CREATE TABLE IF NOT EXISTS ticket_comments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT NOT NULL,
  author_id BIGINT NULL,
  author_name VARCHAR(255) NULL,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  content TEXT NOT NULL,
  edited_at DATETIME NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);

-- Attachments
CREATE TABLE IF NOT EXISTS ticket_attachments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT NOT NULL,
  uploaded_by BIGINT NULL,
  filename VARCHAR(255) NOT NULL,
  storage_path VARCHAR(1024) NOT NULL,
  mime_type VARCHAR(255) NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);

-- Assignments history
CREATE TABLE IF NOT EXISTS ticket_assignments (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT NOT NULL,
  assigned_to BIGINT NULL,
  assigned_by BIGINT NULL,
  note VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);

-- SLA policies
CREATE TABLE IF NOT EXISTS sla_policies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  priority_code VARCHAR(16) NOT NULL,
  first_response_minutes INT NOT NULL,
  resolution_minutes INT NOT NULL,
  work_hours JSON NULL,
  include_holidays BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- SLA tracking events
CREATE TABLE IF NOT EXISTS ticket_sla_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT NOT NULL,
  sla_policy_id INT NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  event_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  meta JSON NULL,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);

-- Audits
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  actor_id BIGINT NULL,
  actor_name VARCHAR(255) NULL,
  action VARCHAR(100) NOT NULL,
  entity VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255) NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  ip_address VARCHAR(100) NULL,
  user_agent VARCHAR(512) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Automatic event correlations (for agent)
CREATE TABLE IF NOT EXISTS automatic_event_correlations (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  device_id BIGINT NULL,
  event_type VARCHAR(255) NOT NULL,
  fingerprint VARCHAR(512) NOT NULL,
  ticket_id BIGINT NULL,
  last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
  occurrences INT NOT NULL DEFAULT 1,
  INDEX (fingerprint(191)),
  FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);

-- Indexes (condicionados: a diferencia de CREATE TABLE, MySQL no admite
-- CREATE INDEX IF NOT EXISTS, y este archivo debe poder ejecutarse más de
-- una vez sin fallar -- ver backend/scripts/run-migrations.js).
SET @idx_status = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'tickets' AND index_name = 'idx_tickets_status');
SET @sql_idx_status = IF(@idx_status = 0, 'CREATE INDEX idx_tickets_status ON tickets(status_id)', 'SELECT 1');
PREPARE stmt_idx_status FROM @sql_idx_status; EXECUTE stmt_idx_status; DEALLOCATE PREPARE stmt_idx_status;

SET @idx_assigned = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'tickets' AND index_name = 'idx_tickets_assigned');
SET @sql_idx_assigned = IF(@idx_assigned = 0, 'CREATE INDEX idx_tickets_assigned ON tickets(assigned_to)', 'SELECT 1');
PREPARE stmt_idx_assigned FROM @sql_idx_assigned; EXECUTE stmt_idx_assigned; DEALLOCATE PREPARE stmt_idx_assigned;

SET @idx_folio = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'tickets' AND index_name = 'idx_tickets_folio');
SET @sql_idx_folio = IF(@idx_folio = 0, 'CREATE INDEX idx_tickets_folio ON tickets(folio)', 'SELECT 1');
PREPARE stmt_idx_folio FROM @sql_idx_folio; EXECUTE stmt_idx_folio; DEALLOCATE PREPARE stmt_idx_folio;
