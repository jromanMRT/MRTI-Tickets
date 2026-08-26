import { describe, expect, it } from 'vitest';
import { mutationDescriptor, sanitizeAuditValue } from './auditMutations';

describe('auditoría transversal de Tickets', () => {
  it('redacta secretos y datos sensibles anidados', () => {
    expect(sanitizeAuditValue({ title: 'Incidencia', token: 'abc', requester: { nss: '123' } })).toEqual({ title: 'Incidencia', token: '[REDACTADO]', requester: { nss: '[REDACTADO]' } });
  });
  it('deriva el evento de la ruta', () => {
    expect(mutationDescriptor('DELETE', '/api/tickets/18/attachments/3')).toEqual({ entityType: 'tickets', entityId: '18', action: 'tickets.deleted' });
  });
});
