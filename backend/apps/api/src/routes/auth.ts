import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { supabaseService, isSupabaseConfigured } from '../config/supabase';
import { authMiddleware } from '../middleware/auth';
import { logger } from '../config/logger';

const router = Router();

// POST /auth/session: Exchange Supabase access token for role + tenant context
router.post('/session', async (req: Request, res: Response) => {
  try {
    const { token, accessToken } = req.body;
    const tokenToUse = token || accessToken;

    if (!tokenToUse) {
      return res.status(400).json({ error: 'Token is required' });
    }

    let userId: string;
    let email: string | undefined;

    if (isSupabaseConfigured) {
      // Validate token using real Supabase
      const { data: { user }, error } = await supabaseService.auth.getUser(tokenToUse);
      if (error || !user) {
        logger.warn({ error }, 'Supabase session token verification failed');
        return res.status(401).json({ error: 'Invalid Supabase session token' });
      }
      userId = user.id;
      email = user.email;
    } else {
      // Validate token locally in mock mode
      const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-secret-key-at-least-32-characters-long';
      try {
        const decoded = jwt.verify(tokenToUse, JWT_SECRET) as any;
        userId = decoded.id || decoded.sub;
        email = decoded.email;
      } catch (err: any) {
        logger.warn({ err: err.message }, 'Mock session token verification failed');
        return res.status(401).json({ error: `Invalid session token: ${err.message}` });
      }
    }

    // Resolve app_users data (role, tenant_id)
    const { data: appUser, error: appUserErr } = await supabaseService
      .from('app_users')
      .select('role, tenant_id, full_name')
      .eq('id', userId)
      .single();

    if (appUserErr || !appUser) {
      logger.warn({ userId, appUserErr }, 'Failed to locate user details in app_users profile table');
      return res.status(401).json({ error: 'User registration profile not found' });
    }

    logger.info({ userId, role: appUser.role, tenantId: appUser.tenant_id }, 'Successfully exchanged user session token');

    return res.json({
      user: {
        id: userId,
        email,
        name: appUser.full_name,
        role: appUser.role,
        tenantId: appUser.tenant_id
      }
    });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Unexpected error in session exchange endpoint');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /me: Retrieve current authenticated session profile info
router.get('/me', authMiddleware, (req: Request, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  return res.json({
    user: req.user
  });
});

export default router;
