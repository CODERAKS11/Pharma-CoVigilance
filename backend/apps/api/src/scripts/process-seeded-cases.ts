import { initQueue, enqueueCaseJob } from '../services/queue';
import { logger } from '../config/logger';

const SEEDED_CASE_IDS = [
  'bfe03eaf-a937-4bfa-b822-6b08f6a5d60b',
  'e21a7c4c-197b-4962-b0b6-64ef4e6670cc',
  '1589aa2a-c57e-44e9-a645-c2d71f186222'
];

async function run() {
  try {
    logger.info('Initializing Redis connection for enqueuing...');
    await initQueue();
    
    for (const id of SEEDED_CASE_IDS) {
      logger.info({ caseId: id }, 'Enqueuing case for AI processing pipeline...');
      await enqueueCaseJob(id);
    }
    
    logger.info('All 3 seeded cases successfully enqueued for processing!');
    // Allow a few seconds for network connection to flush and exit
    setTimeout(() => process.exit(0), 2000);
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to enqueue seeded cases');
    process.exit(1);
  }
}

run();
