export const TERMINAL_TICKET_STATUS_CODES = new Set(['CLOSED', 'CANCELLED']);

const transitions: Record<string, string[]> = {
  NEW: ['ASSIGNED', 'IN_DIAGNOSIS', 'IN_PROGRESS', 'ON_HOLD_USER', 'ON_HOLD_VENDOR', 'CANCELLED'],
  OPEN: ['ASSIGNED', 'IN_DIAGNOSIS', 'IN_PROGRESS', 'ON_HOLD_USER', 'ON_HOLD_VENDOR', 'CANCELLED'],
  ASSIGNED: ['IN_DIAGNOSIS', 'IN_PROGRESS', 'ON_HOLD_USER', 'ON_HOLD_VENDOR', 'CANCELLED'],
  IN_DIAGNOSIS: ['ASSIGNED', 'IN_PROGRESS', 'ON_HOLD_USER', 'ON_HOLD_VENDOR', 'RESOLVED', 'CANCELLED'],
  IN_PROGRESS: ['ASSIGNED', 'IN_DIAGNOSIS', 'ON_HOLD_USER', 'ON_HOLD_VENDOR', 'RESOLVED', 'CANCELLED'],
  ON_HOLD_USER: ['ASSIGNED', 'IN_DIAGNOSIS', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  ON_HOLD_VENDOR: ['ASSIGNED', 'IN_DIAGNOSIS', 'IN_PROGRESS', 'RESOLVED', 'CANCELLED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  REOPENED: ['ASSIGNED', 'IN_DIAGNOSIS', 'IN_PROGRESS', 'ON_HOLD_USER', 'ON_HOLD_VENDOR', 'RESOLVED', 'CANCELLED'],
  CLOSED: [],
  CANCELLED: [],
};

export const STATUS_REASON_REQUIRED = new Set(['ON_HOLD_USER', 'ON_HOLD_VENDOR', 'RESOLVED', 'CLOSED', 'CANCELLED', 'REOPENED']);

export type WorkflowValidation = { valid: true } | { valid: false; code: string; message: string };

export function allowedStatusTransitions(fromStatusCode: string): string[] {
  return transitions[String(fromStatusCode || '').toUpperCase()] || [];
}

export function requiresStatusReason(statusCode: string): boolean {
  return STATUS_REASON_REQUIRED.has(String(statusCode || '').toUpperCase());
}

export function validateStatusTransition(fromStatusCode: string, toStatusCode: string, comment: unknown, assignedTo?: string | null): WorkflowValidation {
  const from = String(fromStatusCode || '').toUpperCase();
  const to = String(toStatusCode || '').toUpperCase();
  if (!to) return { valid: false, code: 'VALIDATION_ERROR', message: 'Selecciona un estado' };
  if (!Object.prototype.hasOwnProperty.call(transitions, to)) return { valid: false, code: 'INVALID_STATUS', message: 'Estado inválido' };
  if (from === to) return { valid: false, code: 'NO_STATUS_CHANGE', message: 'El ticket ya está en ese estado' };
  if (!allowedStatusTransitions(from).includes(to)) {
    return { valid: false, code: 'INVALID_TRANSITION', message: `No se puede cambiar de ${from} a ${to}` };
  }
  const reason = String(comment || '').trim();
  if (requiresStatusReason(to) && reason.length < 3) {
    return { valid: false, code: 'STATUS_REASON_REQUIRED', message: 'Este cambio requiere un motivo de al menos 3 caracteres' };
  }
  if (reason.length > 2000) return { valid: false, code: 'COMMENT_TOO_LONG', message: 'El motivo no puede exceder 2000 caracteres' };
  if ((to === 'RESOLVED' || to === 'CLOSED') && !assignedTo) {
    return { valid: false, code: 'ASSIGNEE_REQUIRED', message: 'Asigna un responsable antes de resolver o cerrar el ticket' };
  }
  return { valid: true };
}
