USE mrti_tickets;

-- Un ticket puede tocar más de una categoría (p. ej. TI · Hardware y TI · Software
-- a la vez), cada una con su propia subcategoría. tickets.category_id/subcategory_id
-- se conservan como la selección "principal" (compatibilidad con reportes existentes),
-- pero el detalle completo vive aquí.
CREATE TABLE IF NOT EXISTS ticket_category_links (
  id INT AUTO_INCREMENT PRIMARY KEY,
  ticket_id BIGINT NOT NULL,
  category_id INT NOT NULL,
  subcategory_id INT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES ticket_categories(id),
  FOREIGN KEY (subcategory_id) REFERENCES ticket_subcategories(id),
  UNIQUE KEY uniq_ticket_category (ticket_id, category_id, subcategory_id)
);

SET @has_link_index = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'ticket_category_links' AND index_name = 'idx_category_links_ticket');
SET @link_index_sql = IF(@has_link_index = 0, 'CREATE INDEX idx_category_links_ticket ON ticket_category_links(ticket_id)', 'SELECT 1');
PREPARE link_index_stmt FROM @link_index_sql; EXECUTE link_index_stmt; DEALLOCATE PREPARE link_index_stmt;

SET @has_subcategory_index = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'ticket_subcategories' AND index_name = 'idx_subcategories_category');
SET @subcategory_index_sql = IF(@has_subcategory_index = 0, 'CREATE INDEX idx_subcategories_category ON ticket_subcategories(category_id)', 'SELECT 1');
PREPARE subcategory_index_stmt FROM @subcategory_index_sql; EXECUTE subcategory_index_stmt; DEALLOCATE PREPARE subcategory_index_stmt;

-- El código identifica de forma estable cada opción y permite reejecutar esta
-- migración sin duplicar catálogos.
SET @has_subcategory_code_index = (SELECT COUNT(*) FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = 'ticket_subcategories' AND index_name = 'uniq_subcategory_code');
SET @subcategory_code_sql = IF(@has_subcategory_code_index = 0, 'CREATE UNIQUE INDEX uniq_subcategory_code ON ticket_subcategories(code)', 'SELECT 1');
PREPARE subcategory_code_stmt FROM @subcategory_code_sql; EXECUTE subcategory_code_stmt; DEALLOCATE PREPARE subcategory_code_stmt;

-- Hasta ahora sólo TI tenía categorías. Se agregan categorías base para el resto
-- de las áreas de negocio para que el selector "área → categoría → detalle"
-- funcione en toda la empresa. Editable después vía la API de categorías.
INSERT IGNORE INTO ticket_categories (name, code, business_area_id, active, sort_order)
SELECT 'Solicitud de compra', 'compras_solicitud', id, 1, 10 FROM business_areas WHERE code = 'compras'
UNION ALL SELECT 'Cotizaciones', 'compras_cotizacion', id, 1, 20 FROM business_areas WHERE code = 'compras'
UNION ALL SELECT 'Seguimiento de pedido', 'compras_seguimiento', id, 1, 30 FROM business_areas WHERE code = 'compras'
UNION ALL SELECT 'Proveedores', 'compras_proveedores', id, 1, 40 FROM business_areas WHERE code = 'compras'
UNION ALL SELECT 'Facturación', 'pagos_facturacion', id, 1, 10 FROM business_areas WHERE code = 'pagos'
UNION ALL SELECT 'Solicitud de pago', 'pagos_solicitud', id, 1, 20 FROM business_areas WHERE code = 'pagos'
UNION ALL SELECT 'Reembolsos', 'pagos_reembolso', id, 1, 30 FROM business_areas WHERE code = 'pagos'
UNION ALL SELECT 'Estado de cuenta', 'pagos_cuenta', id, 1, 40 FROM business_areas WHERE code = 'pagos'
UNION ALL SELECT 'Nómina', 'rh_nomina', id, 1, 10 FROM business_areas WHERE code = 'rh'
UNION ALL SELECT 'Vacaciones y permisos', 'rh_vacaciones', id, 1, 20 FROM business_areas WHERE code = 'rh'
UNION ALL SELECT 'Prestaciones', 'rh_prestaciones', id, 1, 30 FROM business_areas WHERE code = 'rh'
UNION ALL SELECT 'Documentación laboral', 'rh_documentacion', id, 1, 40 FROM business_areas WHERE code = 'rh';

-- Subcategorías (el detalle "hardware o software") para las categorías de TI
-- que ya existían desde el seed original.
INSERT IGNORE INTO ticket_subcategories (category_id, name, code, sort_order)
SELECT id, 'Equipo de cómputo', 'hw_equipo', 10 FROM ticket_categories WHERE code = 'hardware'
UNION ALL SELECT id, 'Impresora', 'hw_impresora', 20 FROM ticket_categories WHERE code = 'hardware'
UNION ALL SELECT id, 'Periféricos (teclado, mouse, monitor)', 'hw_perifericos', 30 FROM ticket_categories WHERE code = 'hardware'
UNION ALL SELECT id, 'Telefonía', 'hw_telefonia', 40 FROM ticket_categories WHERE code = 'hardware'
UNION ALL SELECT id, 'Otro', 'hw_otro', 999 FROM ticket_categories WHERE code = 'hardware'
UNION ALL SELECT id, 'Instalación de programa', 'sw_instalacion', 10 FROM ticket_categories WHERE code = 'software'
UNION ALL SELECT id, 'Licencias', 'sw_licencias', 20 FROM ticket_categories WHERE code = 'software'
UNION ALL SELECT id, 'Actualización o parche', 'sw_actualizacion', 30 FROM ticket_categories WHERE code = 'software'
UNION ALL SELECT id, 'Error de aplicación', 'sw_error', 40 FROM ticket_categories WHERE code = 'software'
UNION ALL SELECT id, 'Otro', 'sw_otro', 999 FROM ticket_categories WHERE code = 'software'
UNION ALL SELECT id, 'Conectividad WiFi', 'net_wifi', 10 FROM ticket_categories WHERE code = 'network'
UNION ALL SELECT id, 'Cableado o punto de red', 'net_cableado', 20 FROM ticket_categories WHERE code = 'network'
UNION ALL SELECT id, 'VPN', 'net_vpn', 30 FROM ticket_categories WHERE code = 'network'
UNION ALL SELECT id, 'Correo electrónico', 'net_correo', 40 FROM ticket_categories WHERE code = 'network'
UNION ALL SELECT id, 'Otro', 'net_otro', 999 FROM ticket_categories WHERE code = 'network'
UNION ALL SELECT id, 'Restablecer contraseña', 'acc_password', 10 FROM ticket_categories WHERE code = 'access'
UNION ALL SELECT id, 'Alta de usuario', 'acc_alta', 20 FROM ticket_categories WHERE code = 'access'
UNION ALL SELECT id, 'Permisos y roles', 'acc_permisos', 30 FROM ticket_categories WHERE code = 'access'
UNION ALL SELECT id, 'Baja de acceso', 'acc_baja', 40 FROM ticket_categories WHERE code = 'access'
UNION ALL SELECT id, 'Otro', 'acc_otro', 999 FROM ticket_categories WHERE code = 'access';

-- Subcategorías para las categorías nuevas de Compras, Pagos y RH.
INSERT IGNORE INTO ticket_subcategories (category_id, name, code, sort_order)
SELECT id, 'Compra de equipo', 'cs_equipo', 10 FROM ticket_categories WHERE code = 'compras_solicitud'
UNION ALL SELECT id, 'Compra de insumos o consumibles', 'cs_insumos', 20 FROM ticket_categories WHERE code = 'compras_solicitud'
UNION ALL SELECT id, 'Compra de servicio', 'cs_servicio', 30 FROM ticket_categories WHERE code = 'compras_solicitud'
UNION ALL SELECT id, 'Otro', 'cs_otro', 999 FROM ticket_categories WHERE code = 'compras_solicitud'
UNION ALL SELECT id, 'Nueva cotización', 'cc_nueva', 10 FROM ticket_categories WHERE code = 'compras_cotizacion'
UNION ALL SELECT id, 'Comparativo de proveedores', 'cc_comparativo', 20 FROM ticket_categories WHERE code = 'compras_cotizacion'
UNION ALL SELECT id, 'Otro', 'cc_otro', 999 FROM ticket_categories WHERE code = 'compras_cotizacion'
UNION ALL SELECT id, 'Estatus de pedido', 'cse_estatus', 10 FROM ticket_categories WHERE code = 'compras_seguimiento'
UNION ALL SELECT id, 'Retraso en entrega', 'cse_retraso', 20 FROM ticket_categories WHERE code = 'compras_seguimiento'
UNION ALL SELECT id, 'Otro', 'cse_otro', 999 FROM ticket_categories WHERE code = 'compras_seguimiento'
UNION ALL SELECT id, 'Alta de proveedor', 'cp_alta', 10 FROM ticket_categories WHERE code = 'compras_proveedores'
UNION ALL SELECT id, 'Actualización de datos', 'cp_actualizacion', 20 FROM ticket_categories WHERE code = 'compras_proveedores'
UNION ALL SELECT id, 'Otro', 'cp_otro', 999 FROM ticket_categories WHERE code = 'compras_proveedores'
UNION ALL SELECT id, 'Solicitud de factura', 'pf_solicitud', 10 FROM ticket_categories WHERE code = 'pagos_facturacion'
UNION ALL SELECT id, 'Corrección de factura', 'pf_correccion', 20 FROM ticket_categories WHERE code = 'pagos_facturacion'
UNION ALL SELECT id, 'Otro', 'pf_otro', 999 FROM ticket_categories WHERE code = 'pagos_facturacion'
UNION ALL SELECT id, 'Pago a proveedor', 'ps_proveedor', 10 FROM ticket_categories WHERE code = 'pagos_solicitud'
UNION ALL SELECT id, 'Pago de servicio', 'ps_servicio', 20 FROM ticket_categories WHERE code = 'pagos_solicitud'
UNION ALL SELECT id, 'Otro', 'ps_otro', 999 FROM ticket_categories WHERE code = 'pagos_solicitud'
UNION ALL SELECT id, 'Gastos de viaje', 'pr_viaje', 10 FROM ticket_categories WHERE code = 'pagos_reembolso'
UNION ALL SELECT id, 'Gastos varios', 'pr_varios', 20 FROM ticket_categories WHERE code = 'pagos_reembolso'
UNION ALL SELECT id, 'Otro', 'pr_otro', 999 FROM ticket_categories WHERE code = 'pagos_reembolso'
UNION ALL SELECT id, 'Consulta de saldo', 'pc_saldo', 10 FROM ticket_categories WHERE code = 'pagos_cuenta'
UNION ALL SELECT id, 'Aclaración de cargo', 'pc_aclaracion', 20 FROM ticket_categories WHERE code = 'pagos_cuenta'
UNION ALL SELECT id, 'Otro', 'pc_otro', 999 FROM ticket_categories WHERE code = 'pagos_cuenta'
UNION ALL SELECT id, 'Aclaración de pago', 'rn_aclaracion', 10 FROM ticket_categories WHERE code = 'rh_nomina'
UNION ALL SELECT id, 'Recibo de nómina', 'rn_recibo', 20 FROM ticket_categories WHERE code = 'rh_nomina'
UNION ALL SELECT id, 'Otro', 'rn_otro', 999 FROM ticket_categories WHERE code = 'rh_nomina'
UNION ALL SELECT id, 'Solicitud de vacaciones', 'rv_solicitud', 10 FROM ticket_categories WHERE code = 'rh_vacaciones'
UNION ALL SELECT id, 'Permiso o incapacidad', 'rv_permiso', 20 FROM ticket_categories WHERE code = 'rh_vacaciones'
UNION ALL SELECT id, 'Otro', 'rv_otro', 999 FROM ticket_categories WHERE code = 'rh_vacaciones'
UNION ALL SELECT id, 'Seguro de gastos médicos', 'rp_seguro', 10 FROM ticket_categories WHERE code = 'rh_prestaciones'
UNION ALL SELECT id, 'Fondo de ahorro', 'rp_ahorro', 20 FROM ticket_categories WHERE code = 'rh_prestaciones'
UNION ALL SELECT id, 'Otro', 'rp_otro', 999 FROM ticket_categories WHERE code = 'rh_prestaciones'
UNION ALL SELECT id, 'Constancia laboral', 'rd_constancia', 10 FROM ticket_categories WHERE code = 'rh_documentacion'
UNION ALL SELECT id, 'Carta de recomendación', 'rd_carta', 20 FROM ticket_categories WHERE code = 'rh_documentacion'
UNION ALL SELECT id, 'Otro', 'rd_otro', 999 FROM ticket_categories WHERE code = 'rh_documentacion';

-- Corrige el nombre de la prioridad P1 (quedó mal codificado / sin acento).
UPDATE ticket_priorities SET name = 'Crítica' WHERE code = 'P1';
