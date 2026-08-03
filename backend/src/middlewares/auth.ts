import { Request, Response, NextFunction } from 'express';
import { introspectToken } from '../integrations/coreClient';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token missing' } });
  const token = auth.slice(7);
  try {
    const resi = await introspectToken(token);
    if (!resi || !resi.active) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token invalid' } });
    req.user = resi.user || {};
    const role = String(req.user.role || '').toLowerCase();
    const allowedModules: string[] = Array.isArray(req.user.allowed_modules) ? req.user.allowed_modules : [];
    if (role !== 'administrator' && !allowedModules.includes('tickets')) {
      return res.status(403).json({
        success: false,
        error: { code: 'MODULE_FORBIDDEN', message: 'Tu área no tiene acceso a MRTI Tickets' },
      });
    }
    return next();
  } catch {
    return res.status(500).json({ success: false, error: { code: 'AUTH_ERROR', message: 'Error verifying token' } });
  }
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.user as any;
    if (!user) return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'No user present' } });
    const perms: string[] = user.permissions || [];
    const roles: string[] = user.roles || [];
    const normalizedRoles = roles.map((role) => role.toLowerCase());
    const rolePermissions: Record<string, string[]> = {
      administrador: ['*'],
      administrator: ['*'],
      supervisor: ['Asignar tickets', 'Consultar reportes', 'Agregar notas internas'],
      técnico: ['Asignar tickets', 'Agregar notas internas'],
      technician: ['Asignar tickets', 'Agregar notas internas'],
    };
    const grantedByRole = normalizedRoles.some((role) =>
      rolePermissions[role]?.includes('*') || rolePermissions[role]?.includes(permission)
    );
    if (grantedByRole || perms.includes(permission)) return next();
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } });
  };
}
