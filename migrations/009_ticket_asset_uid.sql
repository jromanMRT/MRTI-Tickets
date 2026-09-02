USE mrti_tickets;

-- Referencia estable al inventario patrimonial de MRTI-Activos (Fase 1 de la
-- integración de plataforma, CORE_INFRA_MIGRATION_GUIDE.md). Sin FK entre
-- bases -- mismo criterio que related_device_id/requester_id/assigned_to:
-- VARCHAR(64), validado en el backend contra la API de Activos, nunca
-- confiado ciegamente desde el navegador.
SET @has_asset_uid_column = (
  SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = DATABASE() AND table_name = 'tickets' AND column_name = 'asset_uid'
);
SET @asset_uid_column_sql = IF(@has_asset_uid_column = 0,
  'ALTER TABLE tickets ADD COLUMN asset_uid VARCHAR(64) NULL AFTER asset_number',
  'SELECT 1');
PREPARE asset_uid_column_stmt FROM @asset_uid_column_sql;
EXECUTE asset_uid_column_stmt;
DEALLOCATE PREPARE asset_uid_column_stmt;

SET @has_asset_uid_index = (
  SELECT COUNT(*) FROM information_schema.statistics
   WHERE table_schema = DATABASE() AND table_name = 'tickets' AND index_name = 'idx_tickets_asset_uid'
);
SET @asset_uid_index_sql = IF(@has_asset_uid_index = 0,
  'CREATE INDEX idx_tickets_asset_uid ON tickets(asset_uid)',
  'SELECT 1');
PREPARE asset_uid_index_stmt FROM @asset_uid_index_sql;
EXECUTE asset_uid_index_stmt;
DEALLOCATE PREPARE asset_uid_index_stmt;
