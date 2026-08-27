USE mrti_tickets;

-- El área destinataria pertenece al ticket. La categoría puede evolucionar sin
-- alterar qué equipo es responsable de una solicitud histórica.
SET @has_area_column = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'tickets' AND column_name = 'business_area_id'
);
SET @area_column_sql = IF(@has_area_column = 0,
  'ALTER TABLE tickets ADD COLUMN business_area_id INT NULL AFTER origin_area_name',
  'SELECT 1');
PREPARE area_column_stmt FROM @area_column_sql;
EXECUTE area_column_stmt;
DEALLOCATE PREPARE area_column_stmt;

UPDATE tickets t
JOIN ticket_categories c ON c.id = t.category_id
SET t.business_area_id = c.business_area_id
WHERE t.business_area_id IS NULL;

SET @has_area_index = (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'tickets' AND index_name = 'idx_tickets_business_area'
);
SET @area_index_sql = IF(@has_area_index = 0,
  'CREATE INDEX idx_tickets_business_area ON tickets(business_area_id)',
  'SELECT 1');
PREPARE area_index_stmt FROM @area_index_sql;
EXECUTE area_index_stmt;
DEALLOCATE PREPARE area_index_stmt;

SET @has_area_fk = (
  SELECT COUNT(*) FROM information_schema.table_constraints
   WHERE constraint_schema = DATABASE() AND table_name = 'tickets'
     AND constraint_name = 'fk_tickets_business_area' AND constraint_type = 'FOREIGN KEY'
);
SET @area_fk_sql = IF(@has_area_fk = 0,
  'ALTER TABLE tickets ADD CONSTRAINT fk_tickets_business_area FOREIGN KEY (business_area_id) REFERENCES business_areas(id)',
  'SELECT 1');
PREPARE area_fk_stmt FROM @area_fk_sql;
EXECUTE area_fk_stmt;
DEALLOCATE PREPARE area_fk_stmt;
