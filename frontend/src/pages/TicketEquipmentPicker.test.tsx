import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import TicketEquipmentPicker from './TicketEquipmentPicker';
const options = [
  { key: 'asset:other', internal_id: 'TI-002', name: 'Laptop de otra persona', area_name: 'Almacén', asset_uid: 'other', device_id: null },
  { key: 'device:router', internal_id: 'OBS-1', name: 'Router', asset_uid: null, device_id: 'router' },
];
function Form() {
 const [value, setValue] = useState('');
 return <form data-testid="form"><TicketEquipmentPicker options={options} value={value} onChange={setValue}/></form>;
}
test('busca sin acentos, conserva selección al filtrar y permite quitarla', () => {
 render(<Form/>);
 const search = screen.getByRole('searchbox');
 const select = screen.getByRole('combobox');
 fireEvent.change(search, { target: { value: 'almacen' } });
 expect(screen.getAllByRole('option')).toHaveLength(2);
 fireEvent.change(select, { target: { value: 'asset:other' } });
 expect(new FormData(screen.getByTestId('form') as HTMLFormElement).get('affected_equipment')).toBe('asset:other');
 fireEvent.change(search, { target: { value: 'nada coincide' } });
 expect(select).toHaveValue('asset:other');
 fireEvent.change(select, { target: { value: '' } });
 expect(new FormData(screen.getByTestId('form') as HTMLFormElement).get('affected_equipment')).toBe('');
});
