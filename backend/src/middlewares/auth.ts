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

async function authenticateCore(req: Request, res: Response): Promise<boolean> {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token missing' } });
    return false;
  }
  const token = auth.slice(7);
  try {
    const resi = await introspectToken(token);
    if (!resi || !resi.active) {
      if (resi?.unavailable) {
        res.status(503).json({ success: false, error: { code: 'AUTH_UNAVAILABLE', message: 'No se pudo contactar a MRTI Core' } });
        return false;
      }
      res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Token invalid' } });
      return false;
    }
    req.user = resi.user || {};
    return true;
  } catch {
    res.status(500).json({ success: false, error: { code: 'AUTH_ERROR', message: 'Error verifying token' } });
    return false;
  }
}

// Sesión válida de Core sin conceder acceso al módulo operativo de Tickets.
// Se usa sólo en contratos de autoservicio que limitan los datos al usuario.
export async function requireCoreAuth(req: Request, res: Response, next: NextFunction) {
  if (await authenticateCore(req, res)) return next();
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(await authenticateCore(req, res))) return;
  const role = String(req.user?.role || '').toLowerCase();
  const allowedModules: string[] = Array.isArray(req.user?.allowed_modules) ? req.user.allowed_modules : [];
  if (role !== 'administrator' && !allowedModules.includes('tickets')) {
    return res.status(403).json({
      success: false,
      error: { code: 'MODULE_FORBIDDEN', message: 'Tu área no tiene acceso a MRTI Tickets' },
    });
  }
  return next();
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
      supervisor: ['Asignar tickets', 'Consultar reportes', 'Agregar notas internas', 'Administrar base de conocimiento'],
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
