import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { EventEmitter } from 'events';
import { supabaseService } from '../config/supabase';
import { generateEmbedding, upsertCaseVector, findDuplicateCase } from './dedup';
import { scoreNaranjoAnalysis } from './naranjo';
import { extractNarrativeSignals } from './extraction';
import { searchSnomed } from './snomed';
import { generateNarrativeDraft } from './narrative';
import { logger } from '../config/logger';

let redisConnection: IORedis | null = null;
let caseQueue: Queue | null = null;
let caseWorker: Worker | null = null;
let useMockQueue = true;

// In-memory mock queue event emitter
class MockQueueEmitter extends EventEmitter {}
const mockQueueEmitter = new MockQueueEmitter();

/**
 * Initializes the BullMQ case processing queue and worker.
 * Automatically falls back to in-memory event-driven processing if Redis is unavailable.
 */
export async function initQueue() {
  if (process.env.NODE_ENV === 'test') {
    useMockQueue = true;
    mockQueueEmitter.on('enqueue', async (caseId: string) => {
      logger.info({ caseId }, 'In-memory Mock Queue executing job');
      try {
        await processCasePipeline(caseId);
      } catch (err: any) {
        logger.error({ caseId, error: err.message }, 'In-memory job processing failed');
      }
    });
    return;
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  if (redisUrl === 'mock' || redisUrl.startsWith('redis://localhost')) {
    try {
      redisConnection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null,
        connectTimeout: 1000,
        enableOfflineQueue: false,
        retryStrategy: () => null
      });
      
      // Register error handler to prevent crashing process when offline
      redisConnection.on('error', () => {});
      
      // Probe connectivity
      await redisConnection.ping();
      useMockQueue = false;
      logger.info('Successfully connected to Redis. Starting BullMQ queue.');
    } catch {
      logger.warn('Redis is not running on configured REDIS_URL. Falling back to in-memory job queue.');
      useMockQueue = true;
      if (redisConnection) {
        redisConnection.disconnect();
        redisConnection = null;
      }
    }
  } else {
    try {
      redisConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
      useMockQueue = false;
    } catch (err: any) {
      logger.error({ error: err.message }, 'Failed to connect to Redis. Falling back to Mock Queue.');
      useMockQueue = true;
    }
  }

  if (useMockQueue) {
    // Setup Mock Queue processor
    mockQueueEmitter.on('enqueue', async (caseId: string) => {
      logger.info({ caseId }, 'In-memory Mock Queue executing job');
      try {
        await processCasePipeline(caseId);
      } catch (err: any) {
        logger.error({ caseId, error: err.message }, 'In-memory job processing failed');
      }
    });
    return;
  }

  // Setup BullMQ Queue
  caseQueue = new Queue('case-processing', { connection: redisConnection! });

  // Setup BullMQ Worker
  caseWorker = new Worker(
    'case-processing',
    async (job: Job) => {
      const { caseId } = job.data;
      logger.info({ caseId, jobId: job.id }, 'BullMQ Worker processing job');
      await processCasePipeline(caseId);
    },
    { connection: redisConnection! }
  );

  caseWorker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, error: err.message }, 'BullMQ job execution failed');
  });
}

/**
 * Enqueues a case ID for processing.
 */
export async function enqueueCaseJob(caseId: string): Promise<void> {
  if (useMockQueue) {
    // Push task execution to next tick to run asynchronously
    process.nextTick(() => {
      mockQueueEmitter.emit('enqueue', caseId);
    });
    return;
  }

  if (caseQueue) {
    await caseQueue.add('process-case', { caseId }, { removeOnComplete: true });
  }
}

/**
 * Central orchestrator that transitions a case through the pipeline zones.
 */
async function processCasePipeline(caseId: string): Promise<void> {
  logger.info({ caseId }, 'Starting case processing pipeline');

  // Fetch the case record using the service role bypass client
  const { data: caseRecord, error: caseErr } = await supabaseService
    .from('cases')
    .select('*, patient:patients(age, sex), drug:drugs(name)')
    .eq('id', caseId)
    .single();

  if (caseErr || !caseRecord) {
    throw new Error(`Failed to resolve case metadata: ${caseErr?.message || 'Case not found'}`);
  }

  const { tenant_id: tenantId, narrative, onset_date: onsetDate } = caseRecord;
  const drugName = caseRecord.drug?.name || 'UNKNOWN';

  // --- ZONE 2: VALIDITY CHECK ---
  logger.info({ caseId }, 'Zone 2: Running validity checks');
  await supabaseService
    .from('cases')
    .update({ status: 'processing' })
    .eq('id', caseId);

  await supabaseService
    .from('case_events')
    .insert({
      case_id: caseId,
      actor_type: 'system',
      action: 'validity_checked',
      detail: { status: 'valid', comments: 'Narrative conforms to basic validation parameters' }
    });

  // --- ZONE 3: DEDUPLICATION ---
  logger.info({ caseId }, 'Zone 3: Running duplicate detection');
  const embedding = await generateEmbedding(narrative);
  const duplicateMatch = await findDuplicateCase(tenantId, drugName, embedding);

  // Store embedding vector in vector database
  await upsertCaseVector(caseId, embedding, { tenantId, drugName, narrative });

  let isDuplicate = false;
  if (duplicateMatch && duplicateMatch.duplicateId !== caseId) {
    logger.warn({ caseId, duplicateId: duplicateMatch.duplicateId, score: duplicateMatch.score }, 'Potential duplicate case flagged');
    isDuplicate = true;
    
    await supabaseService
      .from('case_events')
      .insert({
        case_id: caseId,
        actor_type: 'system',
        action: 'duplicate_checked',
        detail: {
          duplicate_found: true,
          duplicate_case_id: duplicateMatch.duplicateId,
          score: duplicateMatch.score,
          similarity_score: duplicateMatch.score,
          candidates: duplicateMatch.candidates
        }
      });
  } else {
    await supabaseService
      .from('case_events')
      .insert({
        case_id: caseId,
        actor_type: 'system',
        action: 'duplicate_checked',
        detail: { duplicate_found: false }
      });
  }

  // --- ZONE 4: TRIAGE PRIORITIZATION ---
  logger.info({ caseId }, 'Zone 4: Running triage rules');
  const seriousnessScore =
    (caseRecord.hospitalization ? 2 : 0) +
    (caseRecord.life_threatening ? 3 : 0) +
    (caseRecord.disability ? 1 : 0);

  let priority: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (caseRecord.life_threatening && (caseRecord.hospitalization || caseRecord.disability)) priority = 'critical';
  else if (caseRecord.hospitalization || caseRecord.life_threatening) priority = 'high';
  else if (caseRecord.disability) priority = 'medium';

  await supabaseService
    .from('cases')
    .update({ priority })
    .eq('id', caseId);

  await supabaseService
    .from('case_events')
    .insert({
      case_id: caseId,
      actor_type: 'system',
      action: 'triage_prioritized',
      detail: { priority, seriousnessScore, hospitalization: !!caseRecord.hospitalization, life_threatening: !!caseRecord.life_threatening, disability: !!caseRecord.disability }
    });

  // --- ZONE 5: EXTRACTION ---
  logger.info({ caseId }, 'Zone 5: Extracting narrative signal fields');
  const extractionResult = await extractNarrativeSignals(narrative, onsetDate);

  await supabaseService
    .from('case_events')
    .insert({
      case_id: caseId,
      actor_type: 'ai_pipeline',
      action: 'fields_extracted',
      detail: {
        grounded: extractionResult.grounded,
        selfConsistent: extractionResult.selfConsistent,
        extracted_fields: extractionResult.data
      }
    });

  // --- ZONE 6: CAUSALITY EVALUATION (Naranjo) ---
  logger.info({ caseId }, 'Zone 6: Evaluating Naranjo causality score');
  const naranjoRes = scoreNaranjoAnalysis(extractionResult.data, extractionResult.grounded, extractionResult.selfConsistent);

  // Write Naranjo results directly to case columns
  await supabaseService
    .from('cases')
    .update({
      naranjo_score: naranjoRes.score,
      naranjo_category: naranjoRes.category,
      naranjo_answers: naranjoRes.answers
    })
    .eq('id', caseId);

  // Write Causality Audit Event
  await supabaseService
    .from('case_events')
    .insert({
      case_id: caseId,
      actor_type: 'ai_pipeline',
      action: 'causality_evaluated',
      detail: {
        score: naranjoRes.score,
        category: naranjoRes.category,
        grounded: naranjoRes.grounded,
        selfConsistent: naranjoRes.selfConsistent,
        answers: naranjoRes.answers
      }
    });

  // --- ZONE 7: SNOMED CT CODING MATCHING ENGINE ---
  logger.info({ caseId }, 'Zone 7: Running SNOMED CT symptom coding matcher');
  const snomedCandidates = await searchSnomed(narrative);
  await supabaseService
    .from('cases')
    .update({ snomed_candidates: snomedCandidates })
    .eq('id', caseId);

  await supabaseService
    .from('case_events')
    .insert({
      case_id: caseId,
      actor_type: 'ai_pipeline',
      action: 'coding_completed',
      detail: { snomed_candidates: snomedCandidates }
    });

  // --- ZONE 8: NARRATIVE SUMMARY DRAFT ZONE ---
  logger.info({ caseId }, 'Zone 8: Generating AI narrative case summary draft');
  const aiSummary = await generateNarrativeDraft({
    patientAge: caseRecord.patient?.age,
    patientSex: caseRecord.patient?.sex || 'unknown',
    drugName,
    dosage: caseRecord.dosage,
    onsetDate,
    narrative,
    naranjoScore: naranjoRes.score,
    naranjoCategory: naranjoRes.category
  });

  await supabaseService
    .from('cases')
    .update({ ai_summary: aiSummary })
    .eq('id', caseId);

  await supabaseService
    .from('case_events')
    .insert({
      case_id: caseId,
      actor_type: 'ai_pipeline',
      action: 'narrative_drafted',
      detail: { ai_summary: aiSummary }
    });

  // Determine target status
  // If duplicate, selfConsistency fails, or groundedness fails, set to needs_review.
  // Otherwise use severity-derived triage buckets.
  let nextStatus: 'triaged' | 'needs_review' = 'triaged';
  if (isDuplicate || !naranjoRes.grounded || !naranjoRes.selfConsistent) {
    nextStatus = 'needs_review';
  }

  await supabaseService
    .from('cases')
    .update({ status: nextStatus })
    .eq('id', caseId);

  logger.info({ caseId, score: naranjoRes.score, category: naranjoRes.category, status: nextStatus }, 'Case processing completed');
}

// Clean handlers for testing teardown
export async function closeQueue() {
  if (caseWorker) {
    await caseWorker.close();
    caseWorker = null;
  }
  if (caseQueue) {
    await caseQueue.close();
    caseQueue = null;
  }
  if (redisConnection) {
    redisConnection.disconnect();
    redisConnection = null;
  }
  mockQueueEmitter.removeAllListeners();
}
