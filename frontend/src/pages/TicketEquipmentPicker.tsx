import { useState } from 'react';

export interface EquipmentOption {
  key: string; internal_id: string; name: string; area_name?: string | null;
  asset_uid: string | null; device_id: string | null;
}

export default function TicketEquipmentPicker({ options, value, onChange }: {
  options: EquipmentOption[]; value: string; onChange: (value: string) => void;
}) {
  const [query, setQuery] = useState('');
  const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const visible = options.filter((item) => item.key === value || normalize(`${item.internal_id} ${item.name} ${item.area_name || ''}`).includes(normalize(query.trim())));
  return <div className="full">
    <label>Buscar equipo<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Código TI, nombre o área" /></label>
    <label>Equipo afectado<select name="affected_equipment" value={value} onChange={(event) => onChange(event.target.value)}>
      <option value="">Sin equipo específico</option>
      {visible.map((item) => <option key={item.key} value={item.key}>{[item.internal_id, item.name, item.area_name].filter(Boolean).join(' · ')}</option>)}
    </select></label>
    <small>{options.length ? 'Como administrador puedes elegir equipos de otras personas o áreas. Esto no cambia su asignación.' : 'No hay equipos disponibles para seleccionar. Puedes crear el ticket sin equipo o recargar para volver a consultar.'}</small>
    {options.length > 0 && !visible.length && <small>No hay coincidencias con la búsqueda.</small>}
  </div>;
}
