USE mrti_tickets;

-- Traza el origen de un artículo KB generado automáticamente a partir de un
-- ticket resuelto. source_ticket_id es nullable: los artículos manuales no
-- tienen ticket de origen. No es FK formal (el ticket vive en la misma BD,
-- pero podría borrarse por soft-delete y no queremos cascada).

SET @has_col = (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = 'kb_articles' AND column_name = 'source_ticket_id');
SET @add_col_sql = IF(@has_col = 0, 'ALTER TABLE kb_articles ADD COLUMN source_ticket_id BIGINT NULL AFTER created_by', 'SELECT 1');
PREPARE add_col_stmt FROM @add_col_sql; EXECUTE add_col_stmt; DEALLOCATE PREPARE add_col_stmt;

SET @has_idx = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'kb_articles' AND index_name = 'idx_kb_articles_source_ticket');
SET @idx_sql = IF(@has_idx = 0, 'CREATE INDEX idx_kb_articles_source_ticket ON kb_articles(source_ticket_id)', 'SELECT 1');
PREPARE idx_stmt FROM @idx_sql; EXECUTE idx_stmt; DEALLOCATE PREPARE idx_stmt;
