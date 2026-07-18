import { generateEmbedding } from './dedup';
import { SNOMED_DICTIONARY, SnomedRecord } from '../../../../packages/db/scripts/seed-snomed';
import { logger } from '../config/logger';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = 'snomed_findings';

let useMockSnomed = true;

export interface SnomedCandidate {
  code: string;
  term: string;
  confidence: number;
  selected: boolean;
  source: 'llm_inferred' | 'structured_field' | 'reviewer_confirmed';
}

/**
 * Probes Qdrant and sets up the SNOMED collection status.
 */
export async function initSnomed() {
  try {
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, { signal: AbortSignal.timeout(1000) });
    if (res.ok) {
      useMockSnomed = false;
      logger.info('SNOMED coding engine successfully connected to Qdrant vector store.');
    } else {
      logger.warn('SNOMED Qdrant collection not initialized. Using in-memory lexical matching fallback.');
      useMockSnomed = true;
    }
  } catch {
    logger.warn('Qdrant service offline. SNOMED matching engine running in mock/lexical mode.');
    useMockSnomed = true;
  }
}

/**
 * Calculates a basic lexical match score between query and a candidate record.
 * 1.0 = exact match, > 0.0 = partial match, 0.0 = no match.
 */
function calculateLexicalScore(query: string, record: SnomedRecord): number {
  const q = query.toLowerCase().trim();
  const term = record.term.toLowerCase();
  
  if (term === q) return 1.0;
  if (term.includes(q) || q.includes(term)) return 0.7;

  // Check synonyms
  for (const syn of record.synonyms) {
    const s = syn.toLowerCase();
    if (s === q) return 0.9;
    if (s.includes(q) || q.includes(s)) return 0.6;
  }

  // Calculate simple word overlap coefficient
  const qWords = q.split(/\s+/).filter((w: string) => w.length > 2);
  const tWords = term.split(/\s+/).filter((w: string) => w.length > 2);
  const intersection = qWords.filter((w: string) => tWords.includes(w));
  if (intersection.length > 0) {
    return (intersection.length / Math.max(qWords.length, tWords.length)) * 0.5;
  }

  return 0.0;
}

/**
 * Searches the SNOMED findings using hybrid search.
 * Merges vector similarity (60% weight) and lexical overlap (40% weight).
 */
export async function searchSnomed(queryText: string): Promise<SnomedCandidate[]> {
  logger.info({ queryText }, 'Running SNOMED CT search matching');
  
  if (!queryText) return [];

  const candidates: SnomedCandidate[] = [];

  if (useMockSnomed) {
    // Pure lexical matching against in-memory dictionary
    for (const record of SNOMED_DICTIONARY) {
      const lexScore = calculateLexicalScore(queryText, record);
      if (lexScore > 0.1) {
        candidates.push({
          code: record.code,
          term: record.term,
          confidence: Math.round(lexScore * 100) / 100,
          selected: false,
          source: 'llm_inferred'
        });
      }
    }
  } else {
    try {
      const vector = await generateEmbedding(queryText);
      
      const searchRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vector,
          limit: 5,
          with_payload: true
        })
      });

      if (searchRes.ok) {
        const resultJson = await searchRes.json() as any;
        const matches = resultJson.result || [];

        for (const match of matches) {
          const payload = match.payload;
          const vectorScore = match.score || 0.0; // Cosine similarity (0-1 approx range)
          
          // Combine with lexical score
          const record = SNOMED_DICTIONARY.find((r: SnomedRecord) => r.code === payload.code);
          const lexScore = record ? calculateLexicalScore(queryText, record) : 0.0;

          // Hybrid score tally
          const hybridScore = (vectorScore * 0.6) + (lexScore * 0.4);

          candidates.push({
            code: payload.code,
            term: payload.term,
            confidence: Math.round(hybridScore * 100) / 100,
            selected: false,
            source: 'llm_inferred'
          });
        }
      }
    } catch (err: any) {
      logger.error({ error: err.message }, 'Failed to query Qdrant collection for SNOMED. Running mock fallback.');
      return searchSnomed(queryText); // Recursive retry in mock mode
    }
  }

  // Sort by confidence descending, cap at top 3, filter out extremely low scores
  return candidates
    .filter(c => c.confidence > 0.15)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
}
