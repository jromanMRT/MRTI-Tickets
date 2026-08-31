import { describe, expect, it } from 'vitest';
import { selfTicketEditState } from './selfTicketEditing';

describe('self ticket editing window', () => {
  const createdAt = '2026-08-31T12:00:00.000Z';

  it('allows the requester to edit during the first ten minutes', () => {
    expect(selfTicketEditState({ requester_id: 'u1', created_at: createdAt }, 'u1', new Date('2026-08-31T12:09:59.999Z'))).toMatchObject({
      editable: true,
      is_requester: true,
      editable_until: '2026-08-31T12:10:00.000Z',
    });
  });

  it('closes the window exactly ten minutes after creation', () => {
    expect(selfTicketEditState({ requester_id: 'u1', created_at: createdAt }, 'u1', new Date('2026-08-31T12:10:00.000Z')).editable).toBe(false);
  });

  it('never allows an assignee who is not the requester to edit', () => {
    expect(selfTicketEditState({ requester_id: 'u1', created_at: createdAt }, 'u2', new Date('2026-08-31T12:01:00.000Z'))).toMatchObject({ editable: false, is_requester: false });
  });
});
