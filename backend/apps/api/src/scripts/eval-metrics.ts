import { evaluateNaranjo } from '../services/naranjo';
import { searchSnomed } from '../services/snomed';
import { generateEmbedding, findDuplicateCase, upsertCaseVector, clearMockQdrant } from '../services/dedup';
import { initQueue, closeQueue } from '../services/queue';

interface BenchmarkCase {
  narrative: string;
  drugName: string;
  tenantId: string;
  groundTruthNaranjoScore: number;
  groundTruthSnomedCode: string;
  isDuplicateOfIndex?: number; // index of case in this array that it duplicates
}

const BENCHMARK_DATASET: BenchmarkCase[] = [
  {
    narrative: 'Patient developed severe blistering skin rash (SJS) after taking Metformin.',
    drugName: 'METFORMIN',
    tenantId: 'de000000-0000-0000-0000-000000000001',
    groundTruthNaranjoScore: 3, // Possible
    groundTruthSnomedCode: '73442001' // Stevens-Johnson Syndrome
  },
  {
    narrative: 'Developed mild skin rash and feeling sick after Metformin exposure.',
    drugName: 'METFORMIN',
    tenantId: 'de000000-0000-0000-0000-000000000001',
    groundTruthNaranjoScore: 3,
    groundTruthSnomedCode: '271795006', // Skin rash
    isDuplicateOfIndex: 0 // Near duplicate of case 0
  },
  {
    narrative: 'Patient experienced severe muscle breakdown (rhabdomyolysis) and high temperature after taking Atorvastatin.',
    drugName: 'ATORVASTATIN',
    tenantId: 'de000000-0000-0000-0000-000000000001',
    groundTruthNaranjoScore: 3,
    groundTruthSnomedCode: '109312009' // Rhabdomyolysis
  },
  {
    narrative: 'High fever and joint pain after taking Atorvastatin.',
    drugName: 'ATORVASTATIN',
    tenantId: 'de000000-0000-0000-0000-000000000001',
    groundTruthNaranjoScore: 3,
    groundTruthSnomedCode: '386661006' // Fever
  },
  {
    narrative: 'Stomach ulcer and vomiting post Ibuprofen administration.',
    drugName: 'IBUPROFEN',
    tenantId: 'de000000-0000-0000-0000-000000000001',
    groundTruthNaranjoScore: 3,
    groundTruthSnomedCode: '27624003' // Gastric ulcer
  }
];

export async function runEvaluation() {
  console.log('\n==================================================');
  console.log('PHARMASAFE AUTOMATED SYSTEM EVALUATION CLI REPORT');
  console.log('==================================================\n');

  clearMockQdrant();
  await initQueue();

  let totalNaranjoError = 0;
  let codingTop1Matches = 0;
  let codingTop3Matches = 0;
  
  let dedupTP = 0; // True Positives (Duplicate correctly identified)
  let dedupFP = 0; // False Positives (Incorrect duplicate matches)
  let dedupFN = 0; // False Negatives (Missed duplicate matches)
  let dedupTN = 0; // True Negatives (No duplicate correctly identified)

  const insertedIds: string[] = [];

  for (let i = 0; i < BENCHMARK_DATASET.length; i++) {
    const item = BENCHMARK_DATASET[i];
    const caseId = `eval-case-0000-0000-0000-00000000000${i}`;

    console.log(`Processing evaluation case ${i + 1}/${BENCHMARK_DATASET.length}...`);

    // 1. Evaluate Naranjo MAE
    const naranjoRes = await evaluateNaranjo(item.narrative);
    const scoreDiff = Math.abs(naranjoRes.score - item.groundTruthNaranjoScore);
    totalNaranjoError += scoreDiff;

    // 2. Evaluate SNOMED matching Top-1 / Top-3 accuracy
    const snomedCandidates = await searchSnomed(item.narrative);
    const candidateCodes = snomedCandidates.map(c => c.code);
    
    if (candidateCodes.length > 0 && candidateCodes[0] === item.groundTruthSnomedCode) {
      codingTop1Matches++;
    }
    if (candidateCodes.includes(item.groundTruthSnomedCode)) {
      codingTop3Matches++;
    }

    // 3. Evaluate Deduplication Precision / Recall
    const vector = await generateEmbedding(item.narrative);
    const duplicateMatch = await findDuplicateCase(item.tenantId, item.drugName, vector);
    const matchedId = duplicateMatch ? duplicateMatch.duplicateId : null;

    const actualIsDuplicate = item.isDuplicateOfIndex !== undefined;
    const predictedIsDuplicate = matchedId !== null;

    if (actualIsDuplicate && predictedIsDuplicate) {
      // Check if it matched the correct parent case index
      const parentId = `eval-case-0000-0000-0000-00000000000${item.isDuplicateOfIndex}`;
      if (matchedId === parentId) {
        dedupTP++;
      } else {
        dedupFP++;
      }
    } else if (!actualIsDuplicate && predictedIsDuplicate) {
      dedupFP++;
    } else if (actualIsDuplicate && !predictedIsDuplicate) {
      dedupFN++;
    } else {
      dedupTN++;
    }

    // Index vector in deduplication database for subsequent iterations
    await upsertCaseVector(caseId, vector, { tenantId: item.tenantId, drugName: item.drugName, narrative: item.narrative });
    insertedIds.push(caseId);
  }

  await closeQueue();

  // Metrics Tallies
  const mae = totalNaranjoError / BENCHMARK_DATASET.length;
  const codingTop1 = codingTop1Matches / BENCHMARK_DATASET.length;
  const codingTop3 = codingTop3Matches / BENCHMARK_DATASET.length;

  const precision = dedupTP + dedupFP > 0 ? dedupTP / (dedupTP + dedupFP) : 1.0;
  const recall = dedupTP + dedupFN > 0 ? dedupTP / (dedupTP + dedupFN) : 1.0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 1.0;

  console.log('--------------------------------------------------');
  console.log('RESULTS SUMMARY:');
  console.log('--------------------------------------------------');
  console.log(`Naranjo Causality MAE:          ${mae.toFixed(2)} (Target MAE < 1.0)`);
  console.log(`SNOMED Coding Top-1 Accuracy:  ${(codingTop1 * 100).toFixed(0)}%`);
  console.log(`SNOMED Coding Top-3 Accuracy:  ${(codingTop3 * 100).toFixed(0)}%`);
  console.log(`Deduplication Precision:       ${(precision * 100).toFixed(0)}%`);
  console.log(`Deduplication Recall:          ${(recall * 100).toFixed(0)}%`);
  console.log(`Deduplication F1 Score:        ${f1.toFixed(2)}`);
  console.log('--------------------------------------------------\n');
}

if (require.main === module) {
  runEvaluation();
}
export default runEvaluation;
