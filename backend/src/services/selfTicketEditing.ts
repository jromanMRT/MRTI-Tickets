export const SELF_TICKET_EDIT_WINDOW_MS = 10 * 60 * 1000;

export function selfTicketEditState(ticket: { requester_id?: string | null; created_at?: string | Date | null }, userId: string, now = new Date()) {
  const createdAt = ticket.created_at ? new Date(ticket.created_at) : null;
  const editableUntil = createdAt && !Number.isNaN(createdAt.getTime())
    ? new Date(createdAt.getTime() + SELF_TICKET_EDIT_WINDOW_MS)
    : null;
  const isRequester = String(ticket.requester_id || '') === String(userId || '');
  return {
    editable: Boolean(isRequester && editableUntil && now.getTime() < editableUntil.getTime()),
    editable_until: editableUntil?.toISOString() || null,
    is_requester: isRequester,
  };
}
