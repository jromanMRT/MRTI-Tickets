USE mrti_tickets;

-- Hasta ahora una política de SLA sólo se elegía por prioridad
-- (uq_sla_priority), aunque el módulo ya invirtió en clasificar cada
-- ticket por área y categoría (business_areas/ticket_categories,
-- migraciones 004/005): un P2 de "Nómina" en RH y un P2 de "VPN" en TI
-- tenían el mismo SLA aunque los atienda equipos distintos con turnaround
-- realista distinto. business_area_id/category_id son NULL por defecto
-- ("aplica a cualquier área/categoría con esa prioridad", el
-- comportamiento de siempre); una política más específica (con área y/o
-- categoría) gana sobre una genérica -- ver getSlaPolicyId() en
-- services/ticketService.js.
SET @has_area = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sla_policies' AND COLUMN_NAME = 'business_area_id'
);
SET @area_sql = IF(@has_area = 0, 'ALTER TABLE sla_policies ADD COLUMN business_area_id INT NULL AFTER priority_code', 'SELECT 1');
PREPARE area_stmt FROM @area_sql; EXECUTE area_stmt; DEALLOCATE PREPARE area_stmt;

SET @has_category = (
  SELECT COUNT(*) FROM information_schema.COLUMNS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sla_policies' AND COLUMN_NAME = 'category_id'
);
SET @category_sql = IF(@has_category = 0, 'ALTER TABLE sla_policies ADD COLUMN category_id INT NULL AFTER business_area_id', 'SELECT 1');
PREPARE category_stmt FROM @category_sql; EXECUTE category_stmt; DEALLOCATE PREPARE category_stmt;

SET @has_area_fk = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sla_policies' AND CONSTRAINT_NAME = 'fk_sla_policies_area'
);
SET @area_fk_sql = IF(@has_area_fk = 0, 'ALTER TABLE sla_policies ADD CONSTRAINT fk_sla_policies_area FOREIGN KEY (business_area_id) REFERENCES business_areas(id) ON DELETE SET NULL', 'SELECT 1');
PREPARE area_fk_stmt FROM @area_fk_sql; EXECUTE area_fk_stmt; DEALLOCATE PREPARE area_fk_stmt;

SET @has_category_fk = (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sla_policies' AND CONSTRAINT_NAME = 'fk_sla_policies_category'
);
SET @category_fk_sql = IF(@has_category_fk = 0, 'ALTER TABLE sla_policies ADD CONSTRAINT fk_sla_policies_category FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE SET NULL', 'SELECT 1');
PREPARE category_fk_stmt FROM @category_fk_sql; EXECUTE category_fk_stmt; DEALLOCATE PREPARE category_fk_stmt;

-- MySQL trata cada NULL como distinto en una UNIQUE KEY, así que esta
-- nueva llave sigue permitiendo una sola política "genérica" por
-- prioridad (área y categoría en NULL) y, además, una por cada
-- combinación específica -- sin este cambio, uq_sla_priority impediría
-- crear una segunda política para la misma prioridad aunque sea para una
-- categoría distinta.
SET @has_old_unique = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sla_policies' AND INDEX_NAME = 'uq_sla_priority'
);
SET @drop_old_unique_sql = IF(@has_old_unique > 0, 'ALTER TABLE sla_policies DROP INDEX uq_sla_priority', 'SELECT 1');
PREPARE drop_old_unique_stmt FROM @drop_old_unique_sql; EXECUTE drop_old_unique_stmt; DEALLOCATE PREPARE drop_old_unique_stmt;

SET @has_new_unique = (
  SELECT COUNT(*) FROM information_schema.STATISTICS
   WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sla_policies' AND INDEX_NAME = 'uq_sla_priority_scope'
);
SET @add_new_unique_sql = IF(@has_new_unique = 0, 'ALTER TABLE sla_policies ADD UNIQUE KEY uq_sla_priority_scope (priority_code, business_area_id, category_id)', 'SELECT 1');
PREPARE add_new_unique_stmt FROM @add_new_unique_sql; EXECUTE add_new_unique_stmt; DEALLOCATE PREPARE add_new_unique_stmt;
