USE mrti_tickets;

ALTER TABLE tickets
  MODIFY related_device_id VARCHAR(64) NULL,
  ADD COLUMN requester_number BIGINT UNSIGNED NULL AFTER requester_email,
  ADD COLUMN origin_site_id VARCHAR(64) NULL AFTER site,
  ADD COLUMN origin_site_name VARCHAR(255) NULL AFTER origin_site_id,
  ADD COLUMN origin_building_name VARCHAR(255) NULL AFTER origin_site_name,
  ADD COLUMN origin_floor_name VARCHAR(255) NULL AFTER origin_building_name,
  ADD COLUMN origin_area_id VARCHAR(64) NULL AFTER origin_floor_name,
  ADD COLUMN origin_area_name VARCHAR(255) NULL AFTER origin_area_id,
  ADD COLUMN requester_device_id VARCHAR(64) NULL AFTER related_device_id,
  ADD COLUMN requester_device_internal_id VARCHAR(64) NULL AFTER requester_device_id,
  ADD COLUMN requester_device_name VARCHAR(255) NULL AFTER requester_device_internal_id,
  ADD COLUMN affected_device_internal_id VARCHAR(64) NULL AFTER requester_device_name,
  ADD COLUMN affected_device_name VARCHAR(255) NULL AFTER affected_device_internal_id;

CREATE INDEX idx_tickets_origin_area ON tickets(origin_area_id);
CREATE INDEX idx_tickets_related_device ON tickets(related_device_id);

