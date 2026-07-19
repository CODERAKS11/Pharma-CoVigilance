import path from 'path';
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '../../../.env') });
import { generateOllamaBatchEmbeddings } from '../../../apps/api/src/services/dedup';
import { logger } from '../../../apps/api/src/config/logger';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
const COLLECTION_NAME = 'snomed_findings';
const VECTOR_SIZE = 1024; // BAAI/bge-m3 via local Ollama

const getHeaders = (h: Record<string, string> = {}) => {
  const headersObj = { ...h };
  if (QDRANT_API_KEY) {
    headersObj['api-key'] = QDRANT_API_KEY;
  }
  return headersObj;
};

export interface SnomedRecord {
  code: string;
  term: string;
  synonyms: string[];
  semantic_tag: string;
}

export const SNOMED_DICTIONARY: SnomedRecord[] = [
  // --- Original 20 entries ---
  { code: '73442001', term: 'Stevens-Johnson syndrome', synonyms: ['sjs', 'blistering skin rash', 'toxic skin necrosis'], semantic_tag: 'disorder' },
  { code: '80449002', term: 'Nausea', synonyms: ['feeling sick', 'nauseous', 'queasy'], semantic_tag: 'finding' },
  { code: '422400008', term: 'Vomiting', synonyms: ['emesis', 'throwing up', 'vomited'], semantic_tag: 'finding' },
  { code: '25064002', term: 'Headache', synonyms: ['cephalgia', 'head pain', 'throbbing head'], semantic_tag: 'finding' },
  { code: '39579001', term: 'Anaphylaxis', synonyms: ['anaphylactic shock', 'severe allergic reaction', 'anaphylactic response'], semantic_tag: 'disorder' },
  { code: '65124004', term: 'Dyspnea', synonyms: ['shortness of breath', 'breathlessness', 'difficulty breathing'], semantic_tag: 'finding' },
  { code: '22298006', term: 'Myocardial infarction', synonyms: ['heart attack', 'cardiac infarction', 'coronary thrombosis'], semantic_tag: 'disorder' },
  { code: '50373000', term: 'Hepatotoxicity', synonyms: ['liver injury', 'toxic liver disease', 'hepatic damage'], semantic_tag: 'disorder' },
  { code: '109312009', term: 'Rhabdomyolysis', synonyms: ['muscle breakdown', 'myoglobinuria', 'skeletal muscle necrosis'], semantic_tag: 'disorder' },
  { code: '442685003', term: 'Lactic acidosis', synonyms: ['acidosis', 'high lactate levels', 'blood acidity'], semantic_tag: 'disorder' },
  { code: '27624003', term: 'Gastric ulcer', synonyms: ['stomach ulcer', 'peptic ulcer', 'gastric lesion'], semantic_tag: 'disorder' },
  { code: '29040007', term: 'GI bleeding', synonyms: ['gastrointestinal hemorrhage', 'stomach bleeding', 'blood in stool'], semantic_tag: 'disorder' },
  { code: '48750000', term: 'Angioedema', synonyms: ['facial swelling', 'swollen lips', 'allergic tissue edema'], semantic_tag: 'disorder' },
  { code: '302213007', term: 'Tendon rupture', synonyms: ['torn tendon', 'achilles tendon tear', 'tendon snap'], semantic_tag: 'disorder' },
  { code: '271795006', term: 'Skin rash', synonyms: ['rash', 'hives', 'dermatitis', 'erythema'], semantic_tag: 'finding' },
  { code: '3723001', term: 'Arthralgia', synonyms: ['joint pain', 'painful joints', 'aching joints'], semantic_tag: 'finding' },
  { code: '29857009', term: 'Chest pain', synonyms: ['chest discomfort', 'sternal pain', 'tightness in chest'], semantic_tag: 'finding' },
  { code: '426000000', term: 'Renal impairment', synonyms: ['kidney damage', 'renal failure', 'kidney insufficiency'], semantic_tag: 'disorder' },
  { code: '418363000', term: 'Itching', synonyms: ['pruritus', 'itchy skin'], semantic_tag: 'finding' },
  { code: '386661006', term: 'Fever', synonyms: ['pyrexia', 'high temperature', 'febrile'], semantic_tag: 'finding' },
  // --- Expanded entries: common pharmacovigilance ADRs ---
  { code: '62315008', term: 'Diarrhoea', synonyms: ['diarrhea', 'loose stools', 'watery stool', 'frequent bowel movements'], semantic_tag: 'finding' },
  { code: '404640003', term: 'Dizziness', synonyms: ['vertigo', 'lightheaded', 'unsteady', 'giddiness'], semantic_tag: 'finding' },
  { code: '84229001', term: 'Fatigue', synonyms: ['tiredness', 'lethargy', 'exhaustion', 'malaise'], semantic_tag: 'finding' },
  { code: '193462001', term: 'Insomnia', synonyms: ['sleeplessness', 'difficulty sleeping', 'sleep disturbance', 'unable to sleep'], semantic_tag: 'finding' },
  { code: '56018004', term: 'Alopecia', synonyms: ['hair loss', 'baldness', 'thinning hair', 'hair falling out'], semantic_tag: 'finding' },
  { code: '302215000', term: 'Thrombocytopenia', synonyms: ['low platelet count', 'platelet deficiency', 'reduced platelets'], semantic_tag: 'disorder' },
  { code: '84757009', term: 'Epileptic seizure', synonyms: ['seizure', 'convulsion', 'fit', 'epileptic fit'], semantic_tag: 'disorder' },
  { code: '23502006', term: 'QT prolongation', synonyms: ['long qt syndrome', 'prolonged qt interval', 'cardiac arrhythmia risk'], semantic_tag: 'disorder' },
  { code: '35489007', term: 'Depression', synonyms: ['depressive disorder', 'depressed mood', 'low mood', 'sadness'], semantic_tag: 'disorder' },
  { code: '267038008', term: 'Edema', synonyms: ['oedema', 'swelling', 'fluid retention', 'peripheral edema'], semantic_tag: 'finding' },
  { code: '74474003', term: 'Gastrointestinal disorder', synonyms: ['gi upset', 'abdominal pain', 'stomach cramps', 'dyspepsia'], semantic_tag: 'disorder' },
  { code: '281647001', term: 'Adverse drug reaction', synonyms: ['adr', 'drug side effect', 'medication reaction', 'drug hypersensitivity'], semantic_tag: 'event' },
  { code: '297942002', term: 'Drug-induced liver injury', synonyms: ['dili', 'drug hepatitis', 'medication liver toxicity', 'hepatic injury'], semantic_tag: 'disorder' },
  { code: '49601007', term: 'Cardiovascular disorder', synonyms: ['heart disorder', 'cardiac event', 'cardiovascular event'], semantic_tag: 'disorder' },
  { code: '267036007', term: 'Dyspepsia', synonyms: ['indigestion', 'upset stomach', 'heartburn', 'acid reflux'], semantic_tag: 'finding' },
  { code: '76067001', term: 'Sneezing', synonyms: ['sternutation', 'nasal irritation'], semantic_tag: 'finding' },
  { code: '40917007', term: 'Clouded consciousness', synonyms: ['confusion', 'disorientation', 'altered mental status', 'brain fog'], semantic_tag: 'finding' },
  { code: '271807003', term: 'Eruption', synonyms: ['skin eruption', 'drug eruption', 'maculopapular rash', 'exanthem'], semantic_tag: 'finding' },
  { code: '91175000', term: 'Seizure', synonyms: ['convulsions', 'tonic-clonic seizure', 'grand mal', 'epileptic episode'], semantic_tag: 'disorder' },
  { code: '419284004', term: 'Altered mental status', synonyms: ['mental confusion', 'delirium', 'cognitive impairment', 'disoriented'], semantic_tag: 'finding' },
];

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function fetchWithRetry(url: string, options: RequestInit & { timeoutMs?: number }, retries = 5): Promise<Response> {
  const { timeoutMs, ...restOptions } = options;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const fetchOpts: RequestInit = { ...restOptions };
      if (timeoutMs) {
        fetchOpts.signal = AbortSignal.timeout(timeoutMs);
      }
      const res = await fetch(url, fetchOpts);
      return res;
    } catch (err: any) {
      if (attempt === retries) throw err;
      logger.warn(`Network request to ${url} failed (attempt ${attempt}/${retries}). Retrying in ${attempt * 2}s... Error: ${err.message}`);
      await sleep(attempt * 2000);
    }
  }
  throw new Error(`Failed network request to ${url}`);
}

async function seed() {
  logger.info({
    QDRANT_URL,
    QDRANT_API_KEY: QDRANT_API_KEY ? `${QDRANT_API_KEY.slice(0, 10)}...` : 'undefined',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY ? `${process.env.GEMINI_API_KEY.slice(0, 10)}...` : 'undefined',
    SEED_LIMIT: process.env.SEED_LIMIT
  }, 'Initializing SNOMED CT Qdrant collection...');

  let useMockQdrant = true;
  try {
    const res = await fetchWithRetry(`${QDRANT_URL}/collections`, {
      headers: getHeaders(),
      timeoutMs: 15000
    }, 3);
    if (res.ok) {
      useMockQdrant = false;
    }
  } catch (err: any) {
    logger.error({ error: err.message }, 'Qdrant Cloud connection failed after retries.');
    return;
  }

  try {
    // Check if collection exists
    const checkRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
      headers: getHeaders()
    });

    if (checkRes.status === 404) {
      logger.info(`Creating collection "${COLLECTION_NAME}"...`);
      const createRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
        method: 'PUT',
        headers: getHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          vectors: {
            size: VECTOR_SIZE,
            distance: 'Cosine'
          },
          quantization_config: {
            scalar: {
              type: 'int8',
              available_on_ram: true
            }
          }
        })
      });

      if (!createRes.ok) {
        throw new Error(`Failed to create collection: ${await createRes.text()}`);
      }
    }

    // Load parsed dictionary dynamically if it exists
    let sourceDict: SnomedRecord[] = SNOMED_DICTIONARY;
    try {
      const fs = require('fs');
      const jsonPath = path.join(__dirname, 'snomed-parsed-dictionary.json');
      if (fs.existsSync(jsonPath)) {
        logger.info('Loading parsed RF2 dictionary from JSON file...');
        const fileContent = fs.readFileSync(jsonPath, 'utf-8');
        let parsed = JSON.parse(fileContent) as SnomedRecord[];
        
        const limit = process.env.SEED_LIMIT ? parseInt(process.env.SEED_LIMIT, 10) : 2000;
        if (limit > 0 && parsed.length > limit) {
          parsed = parsed.slice(0, limit);
        }
        
        const existingCodes = new Set(SNOMED_DICTIONARY.map((r: SnomedRecord) => r.code));
        sourceDict = [
          ...SNOMED_DICTIONARY,
          ...parsed.filter((r: SnomedRecord) => !existingCodes.has(r.code))
        ];
        logger.info(`Loaded parsed RF2 dictionary from JSON. Merged total: ${sourceDict.length}`);
      } else {
        const rf2Module = require('./snomed-parsed-dictionary-dictionary');
        if (rf2Module && rf2Module.SNOMED_RF2_DICTIONARY) {
          let parsed = rf2Module.SNOMED_RF2_DICTIONARY as SnomedRecord[];
          
          const limit = process.env.SEED_LIMIT ? parseInt(process.env.SEED_LIMIT, 10) : 2000;
          if (limit > 0 && parsed.length > limit) {
            parsed = parsed.slice(0, limit);
          }
          
          const existingCodes = new Set(SNOMED_DICTIONARY.map((r: SnomedRecord) => r.code));
          sourceDict = [
            ...SNOMED_DICTIONARY,
            ...parsed.filter((r: SnomedRecord) => !existingCodes.has(r.code))
          ];
          logger.info(`Loaded parsed RF2 dictionary from TS. Merged total: ${sourceDict.length}`);
        }
      }
    } catch (err: any) {
      logger.warn(`Failed to load parsed RF2 dictionary: ${err.message}. Using default dictionary.`);
    }

    let currentPointsCount = 0;
    try {
      const countRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
        headers: getHeaders()
      });
      if (countRes.ok) {
        const countInfo = await countRes.json() as any;
        currentPointsCount = countInfo.result?.points_count || 0;
      }
    } catch (e: any) {
      logger.warn(`Failed to fetch current points count: ${e.message}`);
    }

    logger.info(`Collection "${COLLECTION_NAME}" ready. Existing points: ${currentPointsCount}. Seeding remaining ${sourceDict.length - currentPointsCount} findings in batches...`);

    const BATCH_SIZE = 128;
    let upserted = 0;
    let failed = 0;
    const startTime = Date.now();

    for (let i = currentPointsCount; i < sourceDict.length; i += BATCH_SIZE) {
      const batch = sourceDict.slice(i, i + BATCH_SIZE);

      try {
        const textsToEmbed = batch.map(rec => `${rec.term}. Synonyms: ${rec.synonyms.join(', ')}`);
        const vectors = await generateOllamaBatchEmbeddings(textsToEmbed);

        const points = batch.map((rec, batchIdx) => ({
          id: i + batchIdx,
          vector: vectors[batchIdx],
          payload: {
            code: rec.code,
            term: rec.term,
            synonyms: rec.synonyms,
            semantic_tag: rec.semantic_tag
          }
        }));

        const upsertRes = await fetchWithRetry(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points?wait=true`, {
          method: 'PUT',
          headers: getHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ points }),
          timeoutMs: 30000
        });

        if (upsertRes.ok) {
          upserted += points.length;
        } else {
          failed += points.length;
          const errText = await upsertRes.text();
          logger.error(`Upsert batch failed at index ${i}: ${errText}`);
        }
      } catch (err: any) {
        failed += batch.length;
        logger.error(`Error processing batch starting at ${i}: ${err.message}`);
      }

      if ((upserted + failed) % 100 < BATCH_SIZE) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
        logger.info(`Progress: ${upserted}/${sourceDict.length} (${failed} failed) — ${elapsed}s elapsed`);
      }
    }

    logger.info(`SNOMED Qdrant seeding completed. ${upserted} upserted, ${failed} failed.`);
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to seed SNOMED collection');
  }
}

if (require.main === module) {
  seed();
}
export { seed };
