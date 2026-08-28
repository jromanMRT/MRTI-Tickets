-- Corrige de forma independiente al juego de caracteres de la conexión el
-- nombre visible de la prioridad P1. El literal hexadecimal representa
-- "Crítica" en UTF-8 y hace que la migración sea idempotente.
UPDATE ticket_priorities
SET name = CONVERT(0x4372C3AD74696361 USING utf8mb4)
WHERE code = 'P1'
  AND BINARY name <> 0x4372C3AD74696361;
