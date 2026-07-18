import { generateEmbedding, upsertCaseVector } from '../../../apps/api/src/services/dedup';
import { logger } from '../../../apps/api/src/config/logger';

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const COLLECTION_NAME = 'snomed_findings';
const VECTOR_SIZE = 1536;

export interface SnomedRecord {
  code: string;
  term: string;
  synonyms: string[];
  semantic_tag: string;
}

export const SNOMED_DICTIONARY: SnomedRecord[] = [
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
  { code: '386661006', term: 'Fever', synonyms: ['pyrexia', 'high temperature', 'febrile'], semantic_tag: 'finding' }
];

async function seed() {
  logger.info('Initializing SNOMED CT Qdrant collection...');

  let useMockQdrant = true;
  try {
    const res = await fetch(`${QDRANT_URL}/collections`, { signal: AbortSignal.timeout(1000) });
    if (res.ok) {
      useMockQdrant = false;
    }
  } catch {
    logger.warn('Qdrant is offline. Skipping seeding vector collection (in-memory mock index will serve search requests)');
    return;
  }

  try {
    // Recreate Collection
    await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, { method: 'DELETE' });
    const createRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vectors: {
          size: VECTOR_SIZE,
          distance: 'Cosine'
        }
      })
    });

    if (!createRes.ok) {
      throw new Error(`Failed to create collection: ${await createRes.text()}`);
    }

    logger.info(`Collection "${COLLECTION_NAME}" created. Upserting findings...`);

    for (const rec of SNOMED_DICTIONARY) {
      // Create semantic vector based on preferred term + synonyms
      const textToEmbed = `${rec.term}. Synonyms: ${rec.synonyms.join(', ')}`;
      const vector = await generateEmbedding(textToEmbed);

      const upsertRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}/points?wait=true`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: [
            {
              id: rec.code.padStart(36, '0'), // Pad code to standard UUID length/format
              vector,
              payload: {
                code: rec.code,
                term: rec.term,
                synonyms: rec.synonyms,
                semantic_tag: rec.semantic_tag
              }
            }
          ]
        })
      });

      if (!upsertRes.ok) {
        logger.error({ code: rec.code }, 'Failed to upsert SNOMED point');
      }
    }

    logger.info('SNOMED Qdrant seeding completed successfully.');
  } catch (err: any) {
    logger.error({ error: err.message }, 'Failed to seed SNOMED collection');
  }
}

// Only run if executed directly
if (require.main === module) {
  seed();
}
export { seed };
