import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { authMiddleware, requireRole } from '../middleware/auth';
import { generateE2BXml, generatePvPIXml } from '../services/export';
import { searchSnomed } from '../services/snomed';
import { logger } from '../config/logger';

const router = Router();

// Mount SNOMED search route BEFORE global role-reviewer restrictions if needed, or keep it under same review rules
router.get('/snomed/search', authMiddleware, requireRole(['reviewer', 'admin']), async (req: Request, res: Response) => {
  try {
    const { q } = req.query;
    if (!q || typeof q !== 'string') {
      return res.json([]);
    }
    const results = await searchSnomed(q);
    return res.json(results);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Failed to query SNOMED CT codes');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

const reviewConfirmSchema = z.object({
  seriousness: z.array(z.enum(['hospitalization', 'life_threatening', 'disability'])),
  snomedCandidates: z.array(z.object({
    code: z.string(),
    term: z.string(),
    selected: z.boolean(),
    confidence: z.number(),
    source: z.string()
  })),
  naranjoAnswers: z.array(z.object({
    questionId: z.number(),
    question: z.string(),
    answer: z.enum(['yes', 'no', 'unknown']),
    score: z.number()
  })),
  overrideReason: z.string().optional()
});

// Enforce auth middleware globally on review endpoints
router.use(authMiddleware);
router.use(requireRole(['reviewer', 'admin']));

/**
 * POST /cases/:id/review/confirm
 * Reviews, updates, and completes case triage/causality assessment
 */
router.post('/:id/review/confirm', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const parseResult = reviewConfirmSchema.safeParse(req.body);

    if (!parseResult.success) {
      return res.status(400).json({ error: 'Invalid review payload', details: parseResult.error.errors });
    }

    const { seriousness, snomedCandidates, naranjoAnswers, overrideReason } = parseResult.data;

    // Fetch the original case to confirm visibility / tenant isolation
    const { data: caseRecord, error: caseErr } = await req.db
      .from('cases')
      .select('*')
      .eq('id', id)
      .single();

    if (caseErr || !caseRecord) {
      logger.warn({ id, caseErr }, 'Case not found for review');
      return res.status(404).json({ error: 'Case not found or access denied' });
    }

    // 1. Re-calculate Naranjo Score and Category
    const naranjoScore = naranjoAnswers.reduce((sum, a) => sum + a.score, 0);
    let naranjoCategory = 'Doubtful';
    if (naranjoScore >= 9) naranjoCategory = 'Definite';
    else if (naranjoScore >= 5) naranjoCategory = 'Probable';
    else if (naranjoScore >= 1) naranjoCategory = 'Possible';

    // 2. Tag answers and candidates as reviewer_confirmed
    const confirmedAnswers = naranjoAnswers.map(a => ({
      ...a,
      source: 'reviewer_confirmed'
    }));

    const confirmedCandidates = snomedCandidates.map(c => ({
      ...c,
      source: c.selected ? 'reviewer_confirmed' : c.source
    }));

    // 3. Update database case record
    const { error: updateErr } = await req.db
      .from('cases')
      .update({
        status: 'reviewed',
        hospitalization: seriousness.includes('hospitalization'),
        life_threatening: seriousness.includes('life_threatening'),
        disability: seriousness.includes('disability'),
        naranjo_score: naranjoScore,
        naranjo_category: naranjoCategory,
        naranjo_answers: confirmedAnswers,
        snomed_candidates: confirmedCandidates
      })
      .eq('id', id);

    if (updateErr) {
      logger.error({ error: updateErr.message, id }, 'Failed to save review changes');
      return res.status(500).json({ error: updateErr.message });
    }

    // 4. Log review confirmation audit trail event
    const actionName = overrideReason ? 'review_overridden' : 'review_confirmed';
    const { error: eventErr } = await req.db
      .from('case_events')
      .insert({
        case_id: id,
        actor_type: req.user?.role,
        actor_id: req.user?.id,
        action: actionName,
        detail: {
          seriousness,
          snomed_candidates: confirmedCandidates,
          naranjo_score: naranjoScore,
          naranjo_category: naranjoCategory,
          override_reason: overrideReason
        }
      });

    if (eventErr) {
      logger.error({ error: eventErr.message }, 'Failed to record review event');
    }

    logger.info({ id, userId: req.user?.id }, 'Case successfully reviewed and confirmed');
    return res.json({ message: 'Case successfully reviewed and locked' });
  } catch (error: any) {
    logger.error({ error: error.message, id: req.params.id }, 'Unexpected error confirming case review');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /cases/:id/review/reject
 * Rejects a case and updates its status to 'rejected'
 */
router.post('/:id/review/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Fetch the original case to confirm visibility / tenant isolation
    const { data: caseRecord, error: caseErr } = await req.db
      .from('cases')
      .select('*')
      .eq('id', id)
      .single();

    if (caseErr || !caseRecord) {
      logger.warn({ id, caseErr }, 'Case not found for rejection');
      return res.status(404).json({ error: 'Case not found or access denied' });
    }

    // Update status to rejected
    const { error: updateErr } = await req.db
      .from('cases')
      .update({ status: 'rejected' })
      .eq('id', id);

    if (updateErr) {
      logger.error({ error: updateErr.message, id }, 'Failed to reject case');
      return res.status(500).json({ error: updateErr.message });
    }

    // Insert audit event
    const { error: eventErr } = await req.db
      .from('case_events')
      .insert({
        case_id: id,
        actor_type: req.user?.role,
        actor_id: req.user?.id,
        action: 'review_rejected',
        detail: { comments: 'Case rejected by reviewer' }
      });

    if (eventErr) {
      logger.error({ error: eventErr.message }, 'Failed to record rejection event');
    }

    logger.info({ id, userId: req.user?.id }, 'Case successfully rejected');
    return res.json({ message: 'Case successfully rejected' });
  } catch (error: any) {
    logger.error({ error: error.message, id: req.params.id }, 'Unexpected error rejecting case');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /cases/:id/export/e2b
 * Generates and downloads ICH E2B(R3) compliant XML
 */
router.get('/:id/export/e2b', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: caseRecord, error } = await req.db
      .from('cases')
      .select('*, patient:patients(age, sex), drug:drugs(name)')
      .eq('id', id)
      .single();

    if (error || !caseRecord) {
      logger.warn({ id, error }, 'Export query case fetch failed');
      return res.status(404).json({ error: 'Case not found or access denied' });
    }

    const xml = generateE2BXml(caseRecord);

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename=icsr-${id.substring(0, 8)}.xml`);
    return res.send(xml);
  } catch (error: any) {
    logger.error({ error: error.message, id: req.params.id }, 'Unexpected error exporting E2B XML');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /cases/:id/export/pvpi
 * Generates and downloads PvPI compliant XML
 */
router.get('/:id/export/pvpi', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: caseRecord, error } = await req.db
      .from('cases')
      .select('*, patient:patients(age, sex), drug:drugs(name)')
      .eq('id', id)
      .single();

    if (error || !caseRecord) {
      logger.warn({ id, error }, 'Export query case fetch failed');
      return res.status(404).json({ error: 'Case not found or access denied' });
    }

    const xml = generatePvPIXml(caseRecord);

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', `attachment; filename=pvpi-${id.substring(0, 8)}.xml`);
    return res.send(xml);
  } catch (error: any) {
    logger.error({ error: error.message, id: req.params.id }, 'Unexpected error exporting PvPI XML');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
