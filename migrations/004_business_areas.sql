-- Áreas de negocio para separar tickets por sección (TI, Compras, Pagos, RH...)
-- con restricción de quién puede atender cada área.

CREATE TABLE IF NOT EXISTS business_areas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  code VARCHAR(100) NOT NULL UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INT NOT NULL DEFAULT 100,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Quién puede ser asignado a tickets de cada área. Un área sin filas aquí
-- no restringe nada (cualquier admin/supervisor/técnico puede asignarse) —
-- la restricción entra en efecto en cuanto se registra al primer miembro.
CREATE TABLE IF NOT EXISTS business_area_members (
  business_area_id INT NOT NULL,
  user_id VARCHAR(64) NOT NULL,
  user_name VARCHAR(255) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (business_area_id, user_id),
  FOREIGN KEY (business_area_id) REFERENCES business_areas(id) ON DELETE CASCADE
);

ALTER TABLE ticket_categories ADD COLUMN business_area_id INT NULL AFTER code;
ALTER TABLE ticket_categories ADD CONSTRAINT fk_categories_business_area
  FOREIGN KEY (business_area_id) REFERENCES business_areas(id);

INSERT INTO business_areas (name, code, sort_order) VALUES
  ('TI', 'ti', 10),
  ('Compras', 'compras', 20),
  ('Pagos', 'pagos', 30),
  ('RH', 'rh', 40);

UPDATE ticket_categories SET business_area_id = (SELECT id FROM business_areas WHERE code = 'ti')
  WHERE code IN ('hardware', 'software', 'network', 'access');
