import dotenv from 'dotenv';
import path from 'path';
import { logger } from '../config/logger';

dotenv.config({ path: path.join(__dirname, '../../../.env') });
dotenv.config({ path: path.join(__dirname, '../../../../.env') });

const getQdrantUrl = () => process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_URL = getQdrantUrl();
const getQdrantApiKey = () => process.env.QDRANT_API_KEY || '';

// --- HuggingFace Inference Client (for query embeddings) ---
const HF_TOKEN = process.env.HF_TOKEN || '';
let hfClient: any = null;
if (HF_TOKEN) {
  try {
    const { InferenceClient } = require('@huggingface/inference');
    hfClient = new InferenceClient(HF_TOKEN);
  } catch (err: any) {
    logger.warn({ error: err.message }, 'HuggingFace InferenceClient initialization fallback');
  }
}

// --- Ollama configuration (for document embeddings) ---
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = 'bge-m3';

const getHeaders = (h: Record<string, string> = {}) => {
  const headersObj = { ...h };
  const apiKey = getQdrantApiKey();
  if (apiKey) {
    headersObj['api-key'] = apiKey;
  }
  return headersObj;
};

const COLLECTION_NAME = 'cases';
const VECTOR_SIZE = 1024; // BAAI/bge-m3 outputs 1024 dims

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
 * Generates a query embedding using HuggingFace Inference API with BAAI/bge-m3.
 * Used for search queries, deduplication checks, and real-time embedding needs.
 * Retries on transient errors.
 */
export async function generateEmbedding(text: string, retries = 5): Promise<number[]> {
  if (process.env.NODE_ENV === 'test') {
    return new Array(1024).fill(0.1);
  }

  if (!hfClient) {
    throw new Error('HF_TOKEN is not configured in .env file. HuggingFace embeddings are required.');
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await hfClient.featureExtraction({
        model: 'BAAI/bge-m3',
        provider: 'hf-inference',
        inputs: text
      });

      // featureExtraction returns number[] or number[][] — normalize to flat array
      const embedding = Array.isArray(result[0]) ? (result as number[][])[0] : result as number[];

      if (!embedding || embedding.length === 0) {
        throw new Error('Empty embedding returned from HuggingFace');
      }

      return embedding;
    } catch (err: any) {
      if (attempt === retries) {
        logger.error({ error: err.message }, `Failed to generate HuggingFace embedding after ${retries} attempts.`);
        throw new Error(`HuggingFace embedding generation failed: ${err.message}`);
      }
      logger.warn(`HuggingFace embedding attempt ${attempt}/${retries} failed: ${err.message}. Retrying...`);
      await new Promise(r => setTimeout(r, attempt * 1500));
    }
  }

  throw new Error('HuggingFace embedding generation failed: exceeded max retries');
}

/**
 * Generates a document embedding using local Ollama with bge-m3 model.
 * Used for SNOMED seeding and document indexing (runs locally, no rate limits).
 */
export async function generateOllamaEmbedding(text: string, retries = 3): Promise<number[]> {
  if (process.env.NODE_ENV === 'test') {
    return new Array(1024).fill(0.1);
  }

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${OLLAMA_URL}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          input: text
        }),
        signal: AbortSignal.timeout(30000)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Ollama embedding API error ${res.status}: ${errText}`);
      }

      const data = await res.json() as any;
      if (!data?.embeddings?.[0]) {
        throw new Error('Invalid response structure from Ollama embedding API');
      }
      return data.embeddings[0];
    } catch (err: any) {
      if (attempt === retries) {
        logger.error({ error: err.message }, `Failed to generate Ollama embedding after ${retries} attempts.`);
        throw new Error(`Ollama embedding generation failed: ${err.message}`);
      }
      logger.warn(`Ollama embedding attempt ${attempt}/${retries} failed: ${err.message}. Retrying...`);
      await new Promise(r => setTimeout(r, attempt * 2000));
    }
  }

  throw new Error('Ollama embedding generation failed: exceeded max retries');
}

/**
 * Generates batch document embeddings using local Ollama with bge-m3 model.
 * Ollama supports multiple inputs in a single request via the "input" array field.
 * Used for SNOMED seeding (no rate limits, runs locally).
 */
export async function generateOllamaBatchEmbeddings(texts: string[], retries = 3): Promise<number[][]> {
  if (process.env.NODE_ENV === 'test') {
    return texts.map(() => new Array(1024).fill(0.1));
  }

  if (texts.length === 0) return [];

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${OLLAMA_URL}/api/embed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: OLLAMA_MODEL,
          input: texts
        }),
        signal: AbortSignal.timeout(60000)
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Ollama batch embedding API error ${res.status}: ${errText}`);
      }

      const data = await res.json() as any;
      if (!data?.embeddings || !Array.isArray(data.embeddings)) {
        throw new Error('Invalid response structure from Ollama batch embedding API');
      }

      return data.embeddings;
    } catch (err: any) {
      if (attempt === retries) {
        logger.error({ error: err.message }, `Failed to generate Ollama batch embeddings after ${retries} attempts.`);
        throw new Error(`Ollama batch embedding generation failed: ${err.message}`);
      }
      logger.warn(`Ollama batch embedding attempt ${attempt}/${retries} failed: ${err.message}. Retrying...`);
      await new Promise(r => setTimeout(r, attempt * 3000));
    }
  }

  throw new Error('Ollama batch embedding generation failed: exceeded max retries');
}

/**
 * Generates batch query embeddings using HuggingFace Inference API.
 * Processes texts sequentially through the HF featureExtraction endpoint.
 * Used for batch query operations (not for SNOMED seeding — use Ollama for that).
 */
export async function generateBatchEmbeddings(texts: string[], retries = 5): Promise<number[][]> {
  if (texts.length === 0) return [];

  const results: number[][] = [];
  for (const text of texts) {
    const embedding = await generateEmbedding(text, retries);
    results.push(embedding);
  }
  return results;
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

    // Ensure payload indexes exist
    await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/index?wait=true`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        field_name: 'tenantId',
        field_schema: 'keyword'
      })
    });
    await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/index?wait=true`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        field_name: 'drugName',
        field_schema: 'keyword'
      })
    });
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
  const normalizedPayload = {
    ...payload,
    drugName: payload.drugName.toUpperCase()
  };

  if (useMockQdrant) {
    // Remove if exists and push new
    const idx = mockQdrantStore.findIndex(p => p.id === caseId);
    if (idx !== -1) mockQdrantStore.splice(idx, 1);
    
    mockQdrantStore.push({ id: caseId, vector, payload: normalizedPayload });
    return;
  }

  try {
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points?wait=true`, {
      method: 'PUT',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        points: [
          {
            id: caseId,
            vector,
            payload: normalizedPayload
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

export interface DuplicateMatchResult {
  duplicateId: string;
  score: number;
  candidates: Array<{ id: string; score: number }>;
}

/**
 * Search Qdrant for duplicates of cases within the same tenant.
 * Cosine similarity threshold > 0.85 indicates near duplicate.
 */
export async function findDuplicateCase(
  tenantId: string,
  drugName: string,
  vector: number[]
): Promise<DuplicateMatchResult | null> {
  const THRESHOLD = 0.85;

  if (useMockQdrant) {
    // In-memory cosine similarity comparison
    let bestMatchId: string | null = null;
    let highestSim = 0;
    const allMatches: Array<{ id: string; score: number }> = [];

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

        if (similarity > THRESHOLD) {
          allMatches.push({ id: point.id, score: similarity });
          if (similarity > highestSim) {
            highestSim = similarity;
            bestMatchId = point.id;
          }
        }
      }
    }

    if (bestMatchId) {
      return {
        duplicateId: bestMatchId,
        score: highestSim,
        candidates: allMatches.sort((a, b) => b.score - a.score)
      };
    }
    return null;
  }

  try {
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
      method: 'POST',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        vector,
        limit: 5,
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
      return {
        duplicateId: matches[0].id,
        score: matches[0].score,
        candidates: matches.map((m: any) => ({ id: m.id, score: m.score }))
      };
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
