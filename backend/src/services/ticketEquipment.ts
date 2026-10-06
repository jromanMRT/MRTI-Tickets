export class TicketEquipmentError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

// El cliente manda únicamente la clave. Rol y metadatos vienen de Core,
// consultado nuevamente al crear el ticket, nunca del cuerpo de la petición.
export function resolveAdminEquipment(user: any, context: any, body: any) {
  if (!Object.prototype.hasOwnProperty.call(body, 'affected_equipment')) return null;
  if (user?.role !== 'administrator') {
    throw new TicketEquipmentError(403, 'EQUIPMENT_FORBIDDEN', 'Sólo un administrador puede seleccionar equipos de otras personas o áreas');
  }
  const key = body.affected_equipment;
  if (typeof key !== 'string') {
    throw new TicketEquipmentError(400, 'INVALID_EQUIPMENT', 'Selecciona un equipo válido');
  }
  const equipment = key ? context?.equipment_options?.find((item: any) => item.key === key) : null;
  if (key && (!context?.can_select_any_equipment || !equipment)) {
    throw new TicketEquipmentError(400, 'EQUIPMENT_UNAVAILABLE', 'El equipo ya no está disponible. Actualiza la lista y vuelve a seleccionarlo');
  }
  return {
    related_device_id: equipment?.device_id || null,
    asset_uid: equipment?.asset_uid || null,
    asset_number: equipment?.internal_id || null,
    affected_device_internal_id: equipment?.internal_id || null,
    affected_device_name: equipment?.name || null,
  };
}
