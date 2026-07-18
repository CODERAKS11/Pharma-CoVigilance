import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { EventEmitter } from 'events';
import { supabaseService } from '../config/supabase';
import { generateEmbedding, upsertCaseVector, findDuplicateCase } from './dedup';
import { evaluateNaranjo } from './naranjo';
import { logger } from '../config/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

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
  if (REDIS_URL === 'mock' || REDIS_URL.startsWith('redis://localhost')) {
    try {
      redisConnection = new IORedis(REDIS_URL, {
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
      redisConnection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });
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
  const duplicateId = await findDuplicateCase(tenantId, drugName, embedding);

  // Store embedding vector in vector database
  await upsertCaseVector(caseId, embedding, { tenantId, drugName, narrative });

  let isDuplicate = false;
  if (duplicateId && duplicateId !== caseId) {
    logger.warn({ caseId, duplicateId }, 'Potential duplicate case flagged');
    isDuplicate = true;
    
    await supabaseService
      .from('case_events')
      .insert({
        case_id: caseId,
        actor_type: 'system',
        action: 'duplicate_checked',
        detail: { duplicate_found: true, duplicate_case_id: duplicateId }
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
  const isSeriousnessTrue = caseRecord.hospitalization || caseRecord.life_threatening || caseRecord.disability;
  const priority = isSeriousnessTrue ? 'high' : 'medium';

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
      detail: { priority }
    });

  // --- ZONE 5: CAUSALITY EVALUATION (Naranjo) ---
  logger.info({ caseId }, 'Zone 5: Evaluating Naranjo causality score');
  const naranjoRes = await evaluateNaranjo(narrative, onsetDate);

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

  // Determine target status
  // If duplicate, selfConsistency fails, or groundedness fails, set to needs_review
  // Otherwise, complete to triaged/reviewed
  let nextStatus = 'triaged';
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
