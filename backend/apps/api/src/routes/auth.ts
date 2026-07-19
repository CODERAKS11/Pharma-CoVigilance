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

// POST /auth/login: Mock login endpoint to generate valid JWTs for frontend
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    
    if (isSupabaseConfigured) {
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
    }

    // Fallback to local mock mode if Supabase is offline/not configured
    const MOCK_CREDENTIALS: Record<string, { id: string; name: string; role: 'reporter' | 'reviewer' | 'admin'; tenantId: string; pass: string }> = {
      'reviewer@pharmasafe.io': {
        id: '66666666-6666-6666-6666-666666666666',
        name: 'Dr. Sarah Chen',
        role: 'reviewer',
        tenantId: 'de000000-0000-0000-0000-000000000001',
        pass: 'reviewer123'
      },
      'admin@pharmasafe.io': {
        id: '77777777-7777-7777-7777-777777777777',
        name: 'Admin User',
        role: 'admin',
        tenantId: 'de000000-0000-0000-0000-000000000001',
        pass: 'admin123'
      },
      'reporter@pharmasafe.io': {
        id: '55555555-5555-5555-5555-555555555555',
        name: 'Dr. Emily Richards',
        role: 'reporter',
        tenantId: 'de000000-0000-0000-0000-000000000001',
        pass: 'reporter123'
      }
    };

    const targetUser = MOCK_CREDENTIALS[email.toLowerCase()];
    if (!targetUser || targetUser.pass !== password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-secret-key-at-least-32-characters-long';
    // Sign a token containing the role and tenantId context
    const token = jwt.sign(
      {
        id: targetUser.id,
        role: targetUser.role,
        tenantId: targetUser.tenantId,
        email: email.toLowerCase()
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    logger.info({ userId: targetUser.id, email }, 'Signed mock login token successfully');
    
    return res.json({
      token,
      user: {
        id: targetUser.id,
        email: email.toLowerCase(),
        name: targetUser.name,
        role: targetUser.role,
        tenantId: targetUser.tenantId
      }
    });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Unexpected error in login endpoint');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
