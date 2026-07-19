import { Request, Response, NextFunction } from 'express';
import { supabaseService, createRequestClient, isSupabaseConfigured } from '../config/supabase';
import { logger } from '../config/logger';

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        role: 'reporter' | 'reviewer' | 'admin';
        tenantId: string;
        email?: string;
      };
      db?: any;
    }
  }
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Auth validation failed: Authorization header missing or malformed');
      return res.status(401).json({ error: 'Unauthorized: Authorization header is required' });
    }

    const token = authHeader.split(' ')[1];

    if (!isSupabaseConfigured) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }

    // Real Supabase Auth validation
    const { data: { user }, error } = await supabaseService.auth.getUser(token);
    
    if (error || !user) {
      logger.warn({ error }, 'Supabase auth validation token invalid');
      return res.status(401).json({ error: 'Unauthorized: Invalid token' });
    }

    // Query app_users table for role and tenant_id
    const { data: appUser, error: appUserErr } = await supabaseService
      .from('app_users')
      .select('role, tenant_id')
      .eq('id', user.id)
      .single();

    if (appUserErr || !appUser) {
      logger.warn({ appUserErr, userId: user.id }, 'Failed to resolve user tenant/role context');
      return res.status(401).json({ error: 'Unauthorized: User role not found' });
    }

    req.user = {
      id: user.id,
      role: appUser.role,
      tenantId: appUser.tenant_id,
      email: user.email
    };
    
    req.db = createRequestClient(token, req.user);

    next();
  } catch (error: any) {
    logger.error({ error: error.message }, 'Unexpected error in auth middleware');
    return res.status(500).json({ error: 'Internal server error during authentication' });
  }
}

// Route guard helper based on roles
export function requireRole(allowedRoles: Array<'reporter' | 'reviewer' | 'admin'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn({ userId: req.user.id, role: req.user.role, allowedRoles }, 'Access forbidden: Insufficient role permissions');
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }

    next();
  };
}
