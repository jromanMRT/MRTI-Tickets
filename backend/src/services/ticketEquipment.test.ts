import { describe, expect, it } from 'vitest';
import { resolveAdminEquipment } from './ticketEquipment';

const context = { can_select_any_equipment: true, equipment_options: [
  { key: 'asset:other', asset_uid: 'other', device_id: null, internal_id: 'TI-002', name: 'Laptop ajena' },
  { key: 'device:router', asset_uid: null, device_id: 'router', internal_id: 'OBS-1', name: 'Router' },
] };

describe('selección administrativa del equipo afectado', () => {
  it('usa los metadatos de Core y no los enviados por el cliente', () => {
    expect(resolveAdminEquipment({ role: 'administrator' }, context, { affected_equipment: 'asset:other', affected_device_name: 'falso' })).toEqual({
      asset_uid: 'other', related_device_id: null, asset_number: 'TI-002', affected_device_internal_id: 'TI-002', affected_device_name: 'Laptop ajena',
    });
  });
  it('conserva el UUID de Monitor sin inventar un activo', () => {
    expect(resolveAdminEquipment({ role: 'administrator' }, context, { affected_equipment: 'device:router' })).toMatchObject({ related_device_id: 'router', asset_uid: null });
  });
  it.each(['viewer', 'technician', 'supervisor'])('rechaza %s aunque falsifique el permiso en el cuerpo', (role) => {
    expect(() => resolveAdminEquipment({ role }, context, { affected_equipment: 'asset:other', role: 'administrator' })).toThrow('Sólo un administrador');
  });
  it('rechaza equipo retirado o catálogo no disponible', () => {
    expect(() => resolveAdminEquipment({ role: 'administrator' }, null, { affected_equipment: 'asset:other' })).toThrow('ya no está disponible');
  });
  it('sin equipo explícito nunca recurre al habitual', () => {
    expect(resolveAdminEquipment({ role: 'administrator' }, context, { affected_equipment: '' })).toMatchObject({ asset_uid: null, related_device_id: null, affected_device_name: null });
  });
  it('mantiene el contrato anterior cuando no se envía el campo', () => {
    expect(resolveAdminEquipment({ role: 'viewer' }, context, { affected_device_id: 'old-id' })).toBeNull();
  });
  it('rechaza objetos como identificador', () => {
    expect(() => resolveAdminEquipment({ role: 'administrator' }, context, { affected_equipment: {} })).toThrow('equipo válido');
  });
});
