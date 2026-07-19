import { Router, Request, Response } from 'express';
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

    if (!isSupabaseConfigured) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }

    // Validate token using real Supabase
    const { data: { user }, error } = await supabaseService.auth.getUser(tokenToUse);
    if (error || !user) {
      logger.warn({ error }, 'Supabase session token verification failed');
      return res.status(401).json({ error: 'Invalid Supabase session token' });
    }
    userId = user.id;
    email = user.email;

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

// POST /auth/login: Authenticate against Supabase Auth
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (!isSupabaseConfigured) {
      return res.status(503).json({ error: 'Supabase is not configured' });
    }

    // Authenticate via Supabase Auth
    const { data, error } = await supabaseService.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.user || !data.session) {
      logger.warn({ error: error?.message, email }, 'Supabase authentication failed');
      return res.status(401).json({ error: error?.message || 'Invalid email or password' });
    }

    // Query app_users details (role, tenant_id, full_name)
    const { data: appUser, error: appUserErr } = await supabaseService
      .from('app_users')
      .select('role, tenant_id, full_name')
      .eq('id', data.user.id)
      .single();

    if (appUserErr || !appUser) {
      logger.warn({ userId: data.user.id, appUserErr }, 'Failed to locate user details in app_users profile table');
      return res.status(401).json({ error: 'User registration profile not found in database' });
    }

    logger.info({ userId: data.user.id, email }, 'User successfully authenticated via Supabase');

    return res.json({
      token: data.session.access_token,
      user: {
        id: data.user.id,
        email: email.toLowerCase(),
        name: appUser.full_name,
        role: appUser.role,
        tenantId: appUser.tenant_id
      }
    });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Unexpected error in login endpoint');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
