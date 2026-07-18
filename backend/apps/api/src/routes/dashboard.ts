import { Router, Request, Response } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth';
import { calculateDashboardStats } from '../services/dashboard';
import { logger } from '../config/logger';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(['reviewer', 'admin']));

/**
 * GET /dashboard/stats
 * Retrieves aggregated dashboard charts metrics for the reviewer workbench.
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const tenantId = req.user?.tenantId;
    if (!tenantId) {
      return res.status(400).json({ error: 'Tenant context required' });
    }

    const stats = await calculateDashboardStats(tenantId);
    return res.json(stats);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Unexpected error calculating dashboard metrics');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
