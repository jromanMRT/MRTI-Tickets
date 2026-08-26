import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';
import pool from '../config/db';

const sensitiveKey = /password|passphrase|token|secret|authorization|cookie|api.?key|credential|hash|curp|rfc|nss|salary|sueldo|bank|clabe|medical|health|birth.?date/i;
const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function sanitizeAuditValue(value: any, depth = 0): any {
  if (value === null || value === undefined) return value;
  if (depth > 5) return '[profundidad limitada]';
  if (typeof value === 'string') return value.length > 2000 ? `${value.slice(0, 2000)}…` : value;
  if (typeof value !== 'object') return value;
  if (Buffer.isBuffer(value)) return `[archivo ${value.length} bytes]`;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeAuditValue(item, depth + 1));
  return Object.fromEntries(Object.entries(value).slice(0, 100).map(([key, item]) => [key, sensitiveKey.test(key) ? '[REDACTADO]' : sanitizeAuditValue(item, depth + 1)]));
}

export function mutationDescriptor(method: string, originalUrl: string) {
  const parts = String(originalUrl || '').split('?')[0].split('/').filter(Boolean).filter((part) => part !== 'api');
  const entityType = parts[0] || 'unknown';
  const entityId = parts.slice(1).find((part) => /^\d+$|^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(part)) || null;
  const suffix: Record<string, string> = { POST: 'created', PUT: 'replaced', PATCH: 'updated', DELETE: 'deleted' };
  return { entityType, entityId, action: `${entityType}.${suffix[method] || 'changed'}` };
}

export function auditMutations(req: Request, res: Response, next: NextFunction) {
  if (!mutationMethods.has(req.method)) return next();
  const requestBody = sanitizeAuditValue(req.body);
  let responseBody: any = null;
  const originalJson = res.json.bind(res);
  res.json = ((body: any) => { responseBody = sanitizeAuditValue(body); return originalJson(body); }) as typeof res.json;
  res.setHeader('X-Request-Id', randomUUID());
  res.once('finish', () => {
    if (res.statusCode < 200 || res.statusCode >= 400) return;
    const actor = req.user || {};
    const descriptor = mutationDescriptor(req.method, req.originalUrl);
    const after = responseBody?.data ?? requestBody;
    void pool.query(
      'INSERT INTO audit_logs (actor_id,actor_name,action,entity,entity_id,before_json,after_json,ip_address,user_agent) VALUES (?,?,?,?,?,?,?,?,?)',
      [actor.id || null, actor.name || actor.full_name || null, descriptor.action, descriptor.entityType,
        descriptor.entityId, null, after === undefined ? null : JSON.stringify(after), req.ip || null,
        String(req.headers['user-agent'] || '').slice(0, 512) || null]
    ).catch((error) => console.error('[audit:tickets] no fue posible registrar evento:', error.message));
  });
  return next();
}
