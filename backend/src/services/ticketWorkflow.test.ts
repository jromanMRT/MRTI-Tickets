import { allowedStatusTransitions, requiresStatusReason, validateStatusTransition } from './ticketWorkflow';

describe('ticket workflow', () => {
  it('only exposes valid next states', () => {
    expect(allowedStatusTransitions('IN_PROGRESS')).toEqual(expect.arrayContaining(['RESOLVED', 'ON_HOLD_USER']));
    expect(allowedStatusTransitions('CLOSED')).toEqual([]);
  });

  it('requires a reason for auditable states', () => {
    expect(requiresStatusReason('RESOLVED')).toBe(true);
    expect(validateStatusTransition('IN_PROGRESS', 'RESOLVED', '', 'user-1')).toMatchObject({ valid: false, code: 'STATUS_REASON_REQUIRED' });
    expect(validateStatusTransition('IN_PROGRESS', 'RESOLVED', 'Se validó la corrección.', 'user-1')).toEqual({ valid: true });
  });

  it('blocks invalid, repeated and unassigned terminal transitions', () => {
    expect(validateStatusTransition('NEW', 'CLOSED', 'Cierre', 'user-1')).toMatchObject({ valid: false, code: 'INVALID_TRANSITION' });
    expect(validateStatusTransition('RESOLVED', 'RESOLVED', 'Repetido', 'user-1')).toMatchObject({ valid: false, code: 'NO_STATUS_CHANGE' });
    expect(validateStatusTransition('IN_PROGRESS', 'RESOLVED', 'Se corrigió', null)).toMatchObject({ valid: false, code: 'ASSIGNEE_REQUIRED' });
  });
});
