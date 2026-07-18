import { supabaseService } from '../config/supabase';
import { logger } from '../config/logger';

export interface DashboardStatsResult {
  casesProcessed: number;
  avgTimeToReview: string;
  statusBreakdown: Record<string, number>;
  priorityBreakdown: Record<string, number>;
  naranjoBreakdown: Record<string, number>;
  topSuspectDrugs: Array<{ name: string; count: number }>;
}

/**
 * Calculates aggregated dashboard statistics for a tenant.
 */
export async function calculateDashboardStats(tenantId: string): Promise<DashboardStatsResult> {
  logger.info({ tenantId }, 'Calculating dashboard statistics');

  // Query database case records for the tenant
  const { data: cases, error } = await supabaseService
    .from('cases')
    .select('*, drug:drugs(name)')
    .eq('tenant_id', tenantId);

  if (error || !cases) {
    logger.error({ error, tenantId }, 'Failed to query cases for dashboard stats');
    throw new Error(`Failed to calculate dashboard statistics: ${error?.message || 'No cases found'}`);
  }

  const statusBreakdown: Record<string, number> = {
    intake: 0,
    processing: 0,
    triaged: 0,
    needs_review: 0,
    reviewed: 0,
    exported: 0,
    rejected: 0
  };

  const priorityBreakdown: Record<string, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0
  };

  const naranjoBreakdown: Record<string, number> = {
    Definite: 0,
    Probable: 0,
    Possible: 0,
    Doubtful: 0
  };

  const drugCounts: Record<string, number> = {};

  let totalReviewedTimeMs = 0;
  let reviewedCount = 0;

  for (const c of cases) {
    // 1. Status breakdown
    if (statusBreakdown[c.status] !== undefined) {
      statusBreakdown[c.status]++;
    }

    // 2. Priority breakdown
    if (c.priority && priorityBreakdown[c.priority] !== undefined) {
      priorityBreakdown[c.priority]++;
    }

    // 3. Naranjo category breakdown
    if (c.naranjo_category && naranjoBreakdown[c.naranjo_category] !== undefined) {
      naranjoBreakdown[c.naranjo_category]++;
    }

    // 4. Suspect drug volume counts
    const drugName = c.drug?.name || 'Unknown Drug';
    drugCounts[drugName] = (drugCounts[drugName] || 0) + 1;

    // 5. Time-to-review
    if (c.status === 'reviewed') {
      const created = new Date(c.created_at).getTime();
      const updated = new Date(c.updated_at).getTime();
      const diffMs = updated - created;
      if (diffMs > 0) {
        totalReviewedTimeMs += diffMs;
        reviewedCount++;
      }
    }
  }

  // Calculate Average Time to Review
  let avgTimeToReview = 'N/A';
  if (reviewedCount > 0) {
    const avgMs = totalReviewedTimeMs / reviewedCount;
    const avgHours = Math.round((avgMs / (1000 * 60 * 60)) * 10) / 10;
    avgTimeToReview = `${avgHours}h`;
  }

  // Format Top Suspect Drugs list sorted by count descending
  const topSuspectDrugs = Object.entries(drugCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    casesProcessed: cases.length,
    avgTimeToReview,
    statusBreakdown,
    priorityBreakdown,
    naranjoBreakdown,
    topSuspectDrugs
  };
}
