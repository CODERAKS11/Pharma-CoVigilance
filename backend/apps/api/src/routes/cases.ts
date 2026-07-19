import { Router, Request, Response } from 'express';
import { createCaseSchema, updateStatusSchema } from '../schemas/cases';
import { authMiddleware, requireRole } from '../middleware/auth';
import { enqueueCaseJob } from '../services/queue';
import { logger } from '../config/logger';

const router = Router();

// Mount auth middleware for all cases routes
router.use(authMiddleware);

// POST /cases: Submit a case (Reporters or Admins)
router.post('/', requireRole(['reporter', 'admin']), async (req: Request, res: Response) => {
  try {
    const parseResult = createCaseSchema.safeParse(req.body);
    if (!parseResult.success) {
      logger.warn({ errors: parseResult.error.format() }, 'Case creation validation failed');
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.format()
      });
    }

    const {
      patientAge,
      patientSex,
      drugName,
      dosage,
      onsetDate,
      narrative,
      hospitalization,
      lifeThreatening,
      disability,
      reporterType
    } = parseResult.data;

    logger.info({ userId: req.user?.id, tenantId: req.user?.tenantId }, 'Initiating case creation transaction');

    // Call RPC database transaction
    const { data: caseId, error } = await req.db.rpc('create_case_transaction', {
      p_patient_age: patientAge !== undefined ? patientAge : null,
      p_patient_sex: patientSex,
      p_drug_name: drugName,
      p_dosage: dosage !== undefined ? dosage : null,
      p_onset_date: onsetDate !== undefined ? onsetDate : null,
      p_narrative: narrative,
      p_hospitalization: hospitalization,
      p_life_threatening: lifeThreatening,
      p_disability: disability,
      p_reporter_type: reporterType,
      p_reporter_id: req.user?.id
    });

    if (error || !caseId) {
      logger.error({ error, userId: req.user?.id }, 'Case transaction execution failed');
      return res.status(500).json({ error: error?.message || 'Failed to submit case transaction' });
    }

    // Trigger background AI pipeline execution
    await enqueueCaseJob(caseId);

    logger.info({ caseId, userId: req.user?.id }, 'Case successfully created and enqueued');
    return res.status(201).json({
      message: 'Case successfully submitted',
      caseId
    });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Unexpected error during case submission');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /cases: List cases (Reporters see their own submissions via RLS; reviewers/admins see tenant cases)
router.get('/', requireRole(['reporter', 'reviewer', 'admin']), async (req: Request, res: Response) => {
  try {
    const { status, priority, page = '1', pageSize = '10' } = req.query;

    const parsedPage = parseInt(page as string, 10);
    const parsedPageSize = parseInt(pageSize as string, 10);
    
    if (isNaN(parsedPage) || parsedPage <= 0 || isNaN(parsedPageSize) || parsedPageSize <= 0) {
      return res.status(400).json({ error: 'Page and pageSize must be positive integers' });
    }

    const fromRange = (parsedPage - 1) * parsedPageSize;
    const toRange = parsedPage * parsedPageSize - 1;

    let query = req.db.from('cases').select('*');

    if (status) {
      query = query.eq('status', status as string);
    }
    if (priority) {
      query = query.eq('priority', priority as string);
    }

    const { data: cases, error } = await query
      .order('created_at', { ascending: false })
      .range(fromRange, toRange);

    if (error) {
      logger.error({ error }, 'Failed to retrieve cases');
      return res.status(500).json({ error: error.message });
    }

    return res.json({
      cases,
      page: parsedPage,
      pageSize: parsedPageSize
    });
  } catch (error: any) {
    logger.error({ error: error.message }, 'Unexpected error listing cases');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /cases/audit: Get all system-wide audit events (Reviewers and Admins)
router.get('/audit', requireRole(['reviewer', 'admin']), async (req: Request, res: Response) => {
  try {
    const { data: auditEvents, error } = await req.db
      .from('case_events')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      logger.error({ error }, 'Failed to fetch system-wide audit events');
      return res.status(500).json({ error: error.message });
    }

    return res.json(auditEvents);
  } catch (error: any) {
    logger.error({ error: error.message }, 'Unexpected error retrieving system-wide audit logs');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /cases/:id: Get case details (Accessible under RLS constraints)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const { data: caseRecord, error } = await req.db
      .from('cases')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !caseRecord) {
      logger.warn({ id, error }, 'Case details fetch failed or case not visible to user');
      return res.status(404).json({ error: 'Case not found or permission denied' });
    }

    return res.json(caseRecord);
  } catch (error: any) {
    logger.error({ error: error.message, id: req.params.id }, 'Unexpected error retrieving case details');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /cases/:id/audit: Get case events history (Accessible under RLS constraints)
router.get('/:id/audit', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Direct read verifies RLS access rules
    const { data: auditEvents, error } = await req.db
      .from('case_events')
      .select('*')
      .eq('case_id', id)
      .order('created_at', { ascending: true });

    if (error) {
      logger.error({ error, caseId: id }, 'Failed to fetch case events');
      return res.status(500).json({ error: error.message });
    }

    // Return events. RLS will make this return empty/empty-error if reporter does not own case.
    return res.json(auditEvents);
  } catch (error: any) {
    logger.error({ error: error.message, id: req.params.id }, 'Unexpected error retrieving audit trail');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /cases/:id/status: Override case status manually (Admin-only override helper)
router.patch('/:id/status', requireRole(['admin']), async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const parseResult = updateStatusSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: parseResult.error.format()
      });
    }

    const { status: newStatus } = parseResult.data;

    // Get original case record to audit previous state
    const { data: originalCase, error: fetchErr } = await req.db
      .from('cases')
      .select('status')
      .eq('id', id)
      .single();

    if (fetchErr || !originalCase) {
      logger.warn({ id, fetchErr }, 'Fetch of original case failed for status update');
      return res.status(404).json({ error: 'Case not found' });
    }

    // Update case status
    const { data: updatedCase, error: updateErr } = await req.db
      .from('cases')
      .update({ status: newStatus })
      .eq('id', id);

    if (updateErr) {
      logger.error({ updateErr, id }, 'Status override update failed');
      return res.status(500).json({ error: updateErr.message });
    }

    // Insert audit event
    await req.db
      .from('case_events')
      .insert({
        case_id: id,
        actor_type: 'admin',
        actor_id: req.user?.id,
        action: 'status_overridden',
        detail: {
          previous_status: originalCase.status,
          new_status: newStatus
        }
      });

    logger.info({ id, previousStatus: originalCase.status, newStatus, userId: req.user?.id }, 'Status manually overridden by admin');
    return res.json({
      message: 'Status overridden successfully',
      caseId: id,
      previousStatus: originalCase.status,
      newStatus
    });
  } catch (error: any) {
    logger.error({ error: error.message, id: req.params.id }, 'Unexpected error in status override');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
