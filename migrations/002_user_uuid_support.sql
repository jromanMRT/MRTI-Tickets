USE mrti_tickets;

ALTER TABLE tickets
  MODIFY requester_id VARCHAR(64) NULL,
  MODIFY assigned_to VARCHAR(64) NULL,
  ADD COLUMN assigned_to_name VARCHAR(255) NULL AFTER assigned_to,
  MODIFY created_by VARCHAR(64) NULL;

ALTER TABLE ticket_status_history MODIFY changed_by VARCHAR(64) NULL;
ALTER TABLE ticket_comments MODIFY author_id VARCHAR(64) NULL;
ALTER TABLE ticket_attachments MODIFY uploaded_by VARCHAR(64) NULL;
ALTER TABLE ticket_assignments
  MODIFY assigned_to VARCHAR(64) NULL,
  ADD COLUMN assigned_to_name VARCHAR(255) NULL AFTER assigned_to,
  MODIFY assigned_by VARCHAR(64) NULL;
ALTER TABLE audit_logs MODIFY actor_id VARCHAR(64) NULL;

ALTER TABLE sla_policies ADD UNIQUE KEY uq_sla_priority (priority_code);

INSERT INTO sla_policies
  (name, priority_code, first_response_minutes, resolution_minutes, include_holidays)
VALUES
  ('SLA crítico', 'P1', 15, 240, 1),
  ('SLA alto', 'P2', 30, 480, 1),
  ('SLA medio', 'P3', 120, 1440, 1),
  ('SLA bajo', 'P4', 240, 2880, 1)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  first_response_minutes = VALUES(first_response_minutes),
  resolution_minutes = VALUES(resolution_minutes);
