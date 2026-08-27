-- Áreas de negocio para separar tickets por sección (TI, Compras, Pagos, RH...)
-- con restricción de quién puede atender cada área.

USE mrti_tickets;

CREATE TABLE IF NOT EXISTS business_areas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(100) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 100,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Quién puede ver, atender y ser asignado a tickets de cada área. Un área sin
-- integrantes queda visible únicamente para administradores globales.
CREATE TABLE IF NOT EXISTS business_area_members (
  business_area_id INT NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  user_name VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (business_area_id, user_id),
  FOREIGN KEY (business_area_id) REFERENCES business_areas(id) ON DELETE CASCADE
);

SET @has_category_area = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'ticket_categories' AND column_name = 'business_area_id');
SET @category_area_sql = IF(@has_category_area = 0, 'ALTER TABLE ticket_categories ADD COLUMN business_area_id INT NULL AFTER code', 'SELECT 1');
PREPARE category_area_stmt FROM @category_area_sql; EXECUTE category_area_stmt; DEALLOCATE PREPARE category_area_stmt;

SET @has_category_area_fk = (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_schema = DATABASE() AND table_name = 'ticket_categories' AND constraint_name = 'fk_categories_business_area');
SET @category_area_fk_sql = IF(@has_category_area_fk = 0, 'ALTER TABLE ticket_categories ADD CONSTRAINT fk_categories_business_area FOREIGN KEY (business_area_id) REFERENCES business_areas(id)', 'SELECT 1');
PREPARE category_area_fk_stmt FROM @category_area_fk_sql; EXECUTE category_area_fk_stmt; DEALLOCATE PREPARE category_area_fk_stmt;

INSERT IGNORE INTO business_areas (name, code, sort_order) VALUES
  ('TI', 'ti', 10),
  ('Compras', 'compras', 20),
  ('Pagos', 'pagos', 30),
  ('RH', 'rh', 40);

-- Se insertan aquí (en lugar de esperar a seed_data.sql, que corre después)
-- para que el UPDATE de abajo tenga filas que actualizar en una instalación
-- nueva; en seed_data.sql el INSERT IGNORE simplemente no hace nada si ya existen.
INSERT IGNORE INTO ticket_categories (name, code, active, sort_order) VALUES
  ('Hardware','hardware',1,10),
  ('Software','software',1,20),
  ('Red','network',1,30),
  ('Accesos','access',1,40);

UPDATE ticket_categories SET business_area_id = (SELECT id FROM business_areas WHERE code = 'ti')
  WHERE code IN ('hardware', 'software', 'network', 'access');
