import OpenAI from 'openai';
import { logger } from '../config/logger';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';

const getHeaders = (h: Record<string, string> = {}) => {
  const headersObj = { ...h };
  if (QDRANT_API_KEY) {
    headersObj['api-key'] = QDRANT_API_KEY;
  }
  return headersObj;
};

const hasEmbeddingKey = OPENAI_API_KEY && OPENAI_API_KEY !== 'your-openai-api-key';

const openai = new OpenAI({
  apiKey: hasEmbeddingKey ? OPENAI_API_KEY : 'mock-key'
});

const COLLECTION_NAME = 'cases';
const VECTOR_SIZE = 1536; // size of text-embedding-3-small

// Check if Qdrant is active
let useMockQdrant = true;

/**
 * In-memory Mock Qdrant database for local/offline testing
 */
interface MockPoint {
  id: string;
  vector: number[];
  payload: {
    tenantId: string;
    drugName: string;
    narrative: string;
  };
}

const mockQdrantStore: MockPoint[] = [];

/**
 * Generates text embeddings using OpenAI text-embedding-3-small (1536 dims).
 * Falls back to deterministic pseudo-embeddings for testing when offline.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!hasEmbeddingKey) {
    // Generate deterministic pseudo-embedding vector for offline mock testing
    const vector = new Array(VECTOR_SIZE).fill(0);
    const stopWords = new Set(['patient', 'experienced', 'severe', 'after', 'taking', 'intake', 'the', 'on', 'a', 'is', 'was', 'for', 'to', 'with', 'and', 'or', 'in', 'at', 'of', 'from', 'started', 'developed', 'reported', 'reaction', 'adverse', 'event', 'symptoms', 'treatment', 'were', 'given']);
    const words = text.toLowerCase().split(/\s+/).map(w => w.replace(/[^a-z0-9]/g, '')).filter(w => w && !stopWords.has(w));
    for (let i = 0; i < words.length; i++) {
      const hash = words[i].split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const idx = hash % VECTOR_SIZE;
      vector[idx] += 1;
    }
    // Normalize vector
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0)) || 1;
    return vector.map(v => v / magnitude);
  }

  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text
    });
    return response.data[0].embedding;
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to generate embedding from OpenAI. Falling back to pseudo-embeddings');
    // Generate fallback pseudo-embedding
    return generateEmbedding(text);
  }
}

/**
 * Initialize Qdrant collection
 */
export async function initQdrant() {
  if (QDRANT_URL === 'mock' || QDRANT_URL.startsWith('http://localhost')) {
    // Let's probe if Qdrant is actually running locally
    try {
      const res = await fetch(`${QDRANT_URL}/collections`, {
        headers: getHeaders(),
        signal: AbortSignal.timeout(1500)
      });
      if (res.ok) {
        useMockQdrant = false;
        logger.info('Successfully connected to local Qdrant instance');
      }
    } catch {
      logger.warn('Qdrant service is not running on configured QDRANT_URL. Falling back to in-memory Mock Qdrant');
      useMockQdrant = true;
    }
  } else {
    useMockQdrant = false;
  }

  if (useMockQdrant) {
    return;
  }

  try {
    const checkRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
      headers: getHeaders()
    });
    if (checkRes.status === 404) {
      // Collection does not exist, create it
      const createRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
        method: 'PUT',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          vectors: {
            size: VECTOR_SIZE,
            distance: 'Cosine'
          }
        })
      });
      if (createRes.ok) {
        logger.info(`Successfully created Qdrant collection "${COLLECTION_NAME}"`);
      } else {
        logger.error({ status: createRes.status }, 'Failed to create Qdrant collection');
      }
    }
  } catch (err: any) {
    logger.error({ error: err.message }, 'Qdrant initialization failed. Falling back to Mock Qdrant.');
    useMockQdrant = true;
  }
}

/**
 * Upserts a case embedding to Qdrant
 */
export async function upsertCaseVector(
  caseId: string,
  vector: number[],
  payload: { tenantId: string; drugName: string; narrative: string }
): Promise<void> {
  if (useMockQdrant) {
    // Remove if exists and push new
    const idx = mockQdrantStore.findIndex(p => p.id === caseId);
    if (idx !== -1) mockQdrantStore.splice(idx, 1);
    
    mockQdrantStore.push({ id: caseId, vector, payload });
    return;
  }

  try {
    // Format UUID as string if it is not a standard UUID (Qdrant requires UUIDs or integers)
    // Qdrant allows string UUIDs for point IDs
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points?wait=true`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        points: [
          {
            id: caseId,
            vector,
            payload
          }
        ]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Qdrant point upsert failed: ${errText}`);
    }
  } catch (err: any) {
    logger.error({ error: err.message, caseId }, 'Qdrant point upsert encountered a failure');
    throw err;
  }
}

/**
 * Search Qdrant for duplicates of the same drug within the same tenant.
 * Cosine similarity threshold > 0.85 indicates near duplicate.
 */
export async function findDuplicateCase(
  tenantId: string,
  drugName: string,
  vector: number[]
): Promise<string | null> {
  const THRESHOLD = 0.85;

  if (useMockQdrant) {
    // In-memory cosine similarity comparison
    let bestMatchId: string | null = null;
    let highestSim = 0;

    for (const point of mockQdrantStore) {
      if (
        point.payload.tenantId === tenantId &&
        point.payload.drugName.toUpperCase() === drugName.toUpperCase()
      ) {
        // Calculate Cosine Similarity
        const dotProduct = point.vector.reduce((sum, v, i) => sum + v * vector[i], 0);
        const magA = Math.sqrt(point.vector.reduce((sum, v) => sum + v * v, 0)) || 1;
        const magB = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
        const similarity = dotProduct / (magA * magB);

        if (similarity > THRESHOLD && similarity > highestSim) {
          highestSim = similarity;
          bestMatchId = point.id;
        }
      }
    }
    return bestMatchId;
  }

  try {
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        vector,
        limit: 1,
        with_payload: true,
        filter: {
          must: [
            { key: 'tenantId', match: { value: tenantId } },
            { key: 'drugName', match: { value: drugName.toUpperCase() } }
          ]
        }
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Qdrant search failed: ${errText}`);
    }

    const result = await res.json() as any;
    const matches = result.result || [];
    
    if (matches.length > 0 && matches[0].score > THRESHOLD) {
      logger.info({ duplicateId: matches[0].id, score: matches[0].score }, 'Duplicate case identified via semantic search');
      return matches[0].id;
    }

    return null;
  } catch (err: any) {
    logger.error({ error: err.message }, 'Qdrant semantic search failed');
    return null;
  }
}

// Export store clear helper for tests
export function clearMockQdrant() {
  mockQdrantStore.length = 0;
}
