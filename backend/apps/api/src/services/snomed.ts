import { generateEmbedding } from './dedup';
import { logger } from '../config/logger';

export interface SnomedRecord {
  code: string;
  term: string;
  synonyms: string[];
  semantic_tag?: string;
}

export const SNOMED_DICTIONARY: SnomedRecord[] = [
  { code: '73442001', term: 'Stevens-Johnson syndrome', synonyms: ['sjs', 'blistering skin rash', 'toxic skin necrosis'] },
  { code: '80449002', term: 'Nausea', synonyms: ['feeling sick', 'nauseous', 'queasy'] },
  { code: '422400008', term: 'Vomiting', synonyms: ['emesis', 'throwing up', 'vomited'] },
  { code: '25064002', term: 'Headache', synonyms: ['cephalgia', 'head pain', 'throbbing head'] },
  { code: '39579001', term: 'Anaphylaxis', synonyms: ['anaphylactic shock', 'severe allergic reaction', 'anaphylactic response'] },
  { code: '65124004', term: 'Dyspnea', synonyms: ['shortness of breath', 'breathlessness', 'difficulty breathing'] },
  { code: '22298006', term: 'Myocardial infarction', synonyms: ['heart attack', 'cardiac infarction', 'coronary thrombosis'] },
  { code: '50373000', term: 'Hepatotoxicity', synonyms: ['liver injury', 'toxic liver disease', 'hepatic damage'] },
  { code: '109312009', term: 'Rhabdomyolysis', synonyms: ['muscle breakdown', 'myoglobinuria', 'skeletal muscle necrosis'] },
  { code: '442685003', term: 'Lactic acidosis', synonyms: ['acidosis', 'high lactate levels', 'blood acidity'] },
  { code: '27624003', term: 'Gastric ulcer', synonyms: ['stomach ulcer', 'peptic ulcer', 'gastric lesion'] },
  { code: '29040007', term: 'GI bleeding', synonyms: ['gastrointestinal hemorrhage', 'stomach bleeding', 'blood in stool'] },
  { code: '48750000', term: 'Angioedema', synonyms: ['facial swelling', 'swollen lips', 'allergic tissue edema'] },
  { code: '302213007', term: 'Tendon rupture', synonyms: ['torn tendon', 'achilles tendon tear', 'tendon snap'] },
  { code: '271795006', term: 'Skin rash', synonyms: ['rash', 'hives', 'dermatitis', 'erythema'] },
  { code: '3723001', term: 'Arthralgia', synonyms: ['joint pain', 'painful joints', 'aching joints'] },
  { code: '29857009', term: 'Chest pain', synonyms: ['chest discomfort', 'sternal pain', 'tightness in chest'] },
  { code: '426000000', term: 'Renal impairment', synonyms: ['kidney damage', 'renal failure', 'kidney insufficiency'] },
  { code: '418363000', term: 'Itching', synonyms: ['pruritus', 'itchy skin'] },
  { code: '386661006', term: 'Fever', synonyms: ['pyrexia', 'high temperature', 'febrile'] }
];

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
const COLLECTION_NAME = 'snomed_findings';

const getHeaders = (h: Record<string, string> = {}) => {
  const headersObj = { ...h };
  if (QDRANT_API_KEY) {
    headersObj['api-key'] = QDRANT_API_KEY;
  }
  return headersObj;
};

let activeDict: SnomedRecord[] | null = null;

function getActiveDict(): SnomedRecord[] {
  if (activeDict) return activeDict;
  
  activeDict = SNOMED_DICTIONARY;
  try {
    const fs = require('fs');
    const path = require('path');
    const jsonPath = path.join(__dirname, '../../../../packages/db/scripts/snomed-parsed-dictionary.json');
    if (fs.existsSync(jsonPath)) {
      const fileContent = fs.readFileSync(jsonPath, 'utf-8');
      const parsed = JSON.parse(fileContent) as SnomedRecord[];
      const existingCodes = new Set(SNOMED_DICTIONARY.map((r: SnomedRecord) => r.code));
      activeDict = [
        ...SNOMED_DICTIONARY,
        ...parsed.filter((r: SnomedRecord) => !existingCodes.has(r.code))
      ];
    } else {
      const rf2Module = require('../../../../packages/db/scripts/snomed-parsed-dictionary-dictionary');
      if (rf2Module && rf2Module.SNOMED_RF2_DICTIONARY) {
        const parsed = rf2Module.SNOMED_RF2_DICTIONARY as SnomedRecord[];
        const existingCodes = new Set(SNOMED_DICTIONARY.map((r: SnomedRecord) => r.code));
        activeDict = [
          ...SNOMED_DICTIONARY,
          ...parsed.filter((r: SnomedRecord) => !existingCodes.has(r.code))
        ];
      }
    }
  } catch {
    activeDict = SNOMED_DICTIONARY;
  }
  return activeDict;
}

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
    const res = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
      headers: getHeaders(),
      signal: AbortSignal.timeout(15000)
    });
    if (res.ok) {
      useMockSnomed = false;
      logger.info('SNOMED coding engine successfully connected to Qdrant vector store.');
    } else {
      logger.warn('SNOMED Qdrant collection not initialized. Using in-memory lexical matching fallback.');
      useMockSnomed = true;
    }
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Qdrant service offline. SNOMED matching engine running in mock/lexical mode.');
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
    for (const record of getActiveDict()) {
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
        headers: getHeaders({ 'Content-Type': 'application/json' }),
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
          const record = getActiveDict().find((r: SnomedRecord) => r.code === payload.code);
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
