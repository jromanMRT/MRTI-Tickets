USE mrti_tickets;

-- Base de conocimiento: artículos que ayudan a resolver dudas comunes antes
-- de abrir un ticket (o mientras se atiende uno). Un artículo puede
-- vincularse a una categoría/subcategoría para aparecer como sugerencia en
-- "Nuevo ticket", pero también puede ser general (category_id/subcategory_id
-- NULL) y sólo aparecer por búsqueda libre.
-- created_by es VARCHAR(64) como tickets.created_by (002_user_uuid_support.sql):
-- el id de usuario de Core es un UUID, no un entero.
-- ON DELETE SET NULL en ambas FKs: si se borra una categoría/subcategoría,
-- el artículo se conserva (deja de aparecer como sugerencia dirigida, sigue
-- siendo buscable) -- mismo criterio que fk_sla_policies_area/
-- fk_sla_policies_category en 011_sla_policy_scope.sql.
CREATE TABLE IF NOT EXISTS kb_articles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  body MEDIUMTEXT NOT NULL,
  category_id INT NULL,
  subcategory_id INT NULL,
  status ENUM('draft', 'published') NOT NULL DEFAULT 'draft',
  created_by VARCHAR(64) NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES ticket_categories(id) ON DELETE SET NULL,
  FOREIGN KEY (subcategory_id) REFERENCES ticket_subcategories(id) ON DELETE SET NULL
);

-- Índices y FULLTEXT guardados con el mismo patrón information_schema +
-- PREPARE/EXECUTE que ya usan 005_category_hierarchy.sql y
-- 011_sla_policy_scope.sql: schema_migrations sólo marca el archivo
-- aplicado al terminar TODO sin error, así que si un statement fallara a
-- medias, el reintento correría el archivo completo desde el principio --
-- cada DDL debe ser idempotente por sí mismo.
SET @has_category_index = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'kb_articles' AND index_name = 'idx_kb_articles_category');
SET @category_index_sql = IF(@has_category_index = 0, 'CREATE INDEX idx_kb_articles_category ON kb_articles(category_id)', 'SELECT 1');
PREPARE category_index_stmt FROM @category_index_sql; EXECUTE category_index_stmt; DEALLOCATE PREPARE category_index_stmt;

SET @has_subcategory_index = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'kb_articles' AND index_name = 'idx_kb_articles_subcategory');
SET @subcategory_index_sql = IF(@has_subcategory_index = 0, 'CREATE INDEX idx_kb_articles_subcategory ON kb_articles(subcategory_id)', 'SELECT 1');
PREPARE subcategory_index_stmt FROM @subcategory_index_sql; EXECUTE subcategory_index_stmt; DEALLOCATE PREPARE subcategory_index_stmt;

SET @has_status_index = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'kb_articles' AND index_name = 'idx_kb_articles_status');
SET @status_index_sql = IF(@has_status_index = 0, 'CREATE INDEX idx_kb_articles_status ON kb_articles(status)', 'SELECT 1');
PREPARE status_index_stmt FROM @status_index_sql; EXECUTE status_index_stmt; DEALLOCATE PREPARE status_index_stmt;

-- Primer uso de búsqueda de texto en el módulo (no existe infraestructura
-- previa de search). InnoDB FULLTEXT ya es soportado (MySQL 8.0 en
-- docker-compose.yml).
SET @has_fulltext_index = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'kb_articles' AND index_name = 'ft_kb_articles_title_body');
SET @fulltext_index_sql = IF(@has_fulltext_index = 0, 'CREATE FULLTEXT INDEX ft_kb_articles_title_body ON kb_articles(title, body)', 'SELECT 1');
PREPARE fulltext_index_stmt FROM @fulltext_index_sql; EXECUTE fulltext_index_stmt; DEALLOCATE PREPARE fulltext_index_stmt;
