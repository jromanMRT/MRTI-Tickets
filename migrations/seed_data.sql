USE mrti_tickets;

-- Seed statuses
INSERT IGNORE INTO ticket_statuses (code, name, is_system, sort_order) VALUES
('NEW', 'Nuevo', TRUE, 10),
('OPEN', 'Abierto', TRUE, 20),
('ASSIGNED', 'Asignado', TRUE, 30),
('IN_DIAGNOSIS', 'En diagnóstico', TRUE, 40),
('IN_PROGRESS', 'En proceso', TRUE, 50),
('ON_HOLD_USER', 'En espera del usuario', TRUE, 60),
('ON_HOLD_VENDOR', 'En espera de proveedor', TRUE, 70),
('RESOLVED', 'Resuelto', TRUE, 80),
('CLOSED', 'Cerrado', TRUE, 90),
('CANCELLED', 'Cancelado', TRUE, 100),
('REOPENED', 'Reabierto', TRUE, 110);

-- Seed priorities
INSERT IGNORE INTO ticket_priorities (code, name, level) VALUES
('P1','Critica',1),
('P2','Alta',2),
('P3','Media',3),
('P4','Baja',4);

-- Example categories
INSERT IGNORE INTO ticket_categories (name, code, active, sort_order) VALUES
('Hardware','hardware',1,10),
('Software','software',1,20),
('Red','network',1,30),
('Accesos','access',1,40);
