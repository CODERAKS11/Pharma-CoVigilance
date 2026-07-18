import { z } from 'zod';
import { callGuardedAI } from './ai';
import { logger } from '../config/logger';

// Zod Schema for consolidated Naranjo narrative analysis
export const naranjoAnalysisSchema = z.object({
  conclusiveReports: z.enum(['yes', 'no', 'unknown']),
  conclusiveReportsQuote: z.string().default(''),
  onsetAfterDrug: z.enum(['yes', 'no', 'unknown']),
  onsetAfterDrugQuote: z.string().default(''),
  improvedOnDechallenge: z.enum(['yes', 'no', 'unknown']),
  improvedOnDechallengeQuote: z.string().default(''),
  reappearedOnRechallenge: z.enum(['yes', 'no', 'unknown']),
  reappearedOnRechallengeQuote: z.string().default(''),
  alternativeCauses: z.enum(['yes', 'no', 'unknown']),
  alternativeCausesQuote: z.string().default(''),
  similarReactionPrevious: z.enum(['yes', 'no', 'unknown']),
  similarReactionPreviousQuote: z.string().default(''),
  objectiveEvidence: z.enum(['yes', 'no', 'unknown']),
  objectiveEvidenceQuote: z.string().default('')
});

export type NaranjoAnalysis = z.infer<typeof naranjoAnalysisSchema>;

export interface NaranjoEvaluationResult {
  score: number;
  category: 'Definite' | 'Probable' | 'Possible' | 'Doubtful';
  answers: Array<{
    questionId: number;
    question: string;
    answer: 'yes' | 'no' | 'unknown';
    score: number;
    supportingQuote?: string;
  }>;
  grounded: boolean;
  selfConsistent: boolean;
}

const NARANJO_QUESTIONS = [
  { id: 1, text: 'Are there previous conclusive reports on this reaction?' },
  { id: 2, text: 'Did the adverse event appear after the suspected drug was administered?' },
  { id: 3, text: 'Did the adverse reaction improve when the drug was discontinued or a specific antagonist was administered?' },
  { id: 4, text: 'Did the adverse reaction reappear when the drug was readministered?' },
  { id: 5, text: 'Are there alternative causes (other than the drug) that could on their own have caused the reaction?' },
  { id: 6, text: 'Did the reaction reappear when a placebo was given?' },
  { id: 7, text: 'Was the drug detected in the blood (or other fluids) in concentrations known to be toxic?' },
  { id: 8, text: 'Was the reaction more severe when the dose was increased, or less severe when the dose was decreased?' },
  { id: 9, text: 'Did the patient have a similar reaction to the same or similar drugs in any previous exposure?' },
  { id: 10, text: 'Was the adverse event confirmed by any objective evidence?' }
];

/**
 * Executes a Naranjo ADR Probability Scale evaluation on a case narrative.
 */
export async function evaluateNaranjo(
  narrative: string,
  onsetDate?: Date | string | null
): Promise<NaranjoEvaluationResult> {
  logger.info('Running Naranjo algorithm evaluation');

  const prompt = `Analyze the medical narrative and extract answers to the following Naranjo scale questions:
1. conclusiveReports: Are there previous conclusive reports on this reaction?
2. onsetAfterDrug: Did the adverse event appear after the suspected drug was administered?
3. improvedOnDechallenge: Did the adverse reaction improve when the drug was discontinued or a specific antagonist was administered?
4. reappearedOnRechallenge: Did the adverse reaction reappear when the drug was readministered?
5. alternativeCauses: Are there alternative causes (other than the drug) that could on their own have caused the reaction?
6. similarReactionPrevious: Did the patient have a similar reaction to the same or similar drugs in any previous exposure?
7. objectiveEvidence: Was the adverse event confirmed by any objective evidence?

For each field, return "yes", "no", or "unknown".
Provide the exact text quote from the narrative that justifies each answer in the corresponding "Quote" fields.`;

  // 1. Run Guarded AI model call
  const aiResult = await callGuardedAI({
    prompt,
    narrative,
    responseSchema: naranjoAnalysisSchema,
    onsetDate,
    temperature: 0.1
  });

  const analysis = aiResult.data;

  // 2. Score mapping
  const answers: NaranjoEvaluationResult['answers'] = [];

  // Q1: Conclusive reports (Yes = +1, No = 0, Unknown = 0)
  const q1Score = analysis.conclusiveReports === 'yes' ? 1 : 0;
  answers.push({ questionId: 1, question: NARANJO_QUESTIONS[0].text, answer: analysis.conclusiveReports, score: q1Score, supportingQuote: analysis.conclusiveReportsQuote });

  // Q2: Onset after drug (Yes = +2, No = -1, Unknown = 0)
  const q2Score = analysis.onsetAfterDrug === 'yes' ? 2 : (analysis.onsetAfterDrug === 'no' ? -1 : 0);
  answers.push({ questionId: 2, question: NARANJO_QUESTIONS[1].text, answer: analysis.onsetAfterDrug, score: q2Score, supportingQuote: analysis.onsetAfterDrugQuote });

  // Q3: Dechallenge improvement (Yes = +1, No = 0, Unknown = 0)
  const q3Score = analysis.improvedOnDechallenge === 'yes' ? 1 : 0;
  answers.push({ questionId: 3, question: NARANJO_QUESTIONS[2].text, answer: analysis.improvedOnDechallenge, score: q3Score, supportingQuote: analysis.improvedOnDechallengeQuote });

  // Q4: Rechallenge (Yes = +2, No = -1, Unknown = 0)
  const q4Score = analysis.reappearedOnRechallenge === 'yes' ? 2 : (analysis.reappearedOnRechallenge === 'no' ? -1 : 0);
  answers.push({ questionId: 4, question: NARANJO_QUESTIONS[3].text, answer: analysis.reappearedOnRechallenge, score: q4Score, supportingQuote: analysis.reappearedOnRechallengeQuote });

  // Q5: Alternative causes (Yes = -1, No = +2, Unknown = 0)
  const q5Score = analysis.alternativeCauses === 'yes' ? -1 : (analysis.alternativeCauses === 'no' ? 2 : 0);
  answers.push({ questionId: 5, question: NARANJO_QUESTIONS[4].text, answer: analysis.alternativeCauses, score: q5Score, supportingQuote: analysis.alternativeCausesQuote });

  // Q6-Q8: Typically require clinical measurements, default to unknown in general narrative unless explicitly stated.
  // We model them as 'unknown' for this automation phase.
  answers.push({ questionId: 6, question: NARANJO_QUESTIONS[5].text, answer: 'unknown', score: 0 });
  answers.push({ questionId: 7, question: NARANJO_QUESTIONS[6].text, answer: 'unknown', score: 0 });
  answers.push({ questionId: 8, question: NARANJO_QUESTIONS[7].text, answer: 'unknown', score: 0 });

  // Q9: Similar reaction previous (Yes = +1, No = 0, Unknown = 0)
  const q9Score = analysis.similarReactionPrevious === 'yes' ? 1 : 0;
  answers.push({ questionId: 9, question: NARANJO_QUESTIONS[8].text, answer: analysis.similarReactionPrevious, score: q9Score, supportingQuote: analysis.similarReactionPreviousQuote });

  // Q10: Objective evidence confirmation (Yes = +1, No = 0, Unknown = 0)
  const q10Score = analysis.objectiveEvidence === 'yes' ? 1 : 0;
  answers.push({ questionId: 10, question: NARANJO_QUESTIONS[9].text, answer: analysis.objectiveEvidence, score: q10Score, supportingQuote: analysis.objectiveEvidenceQuote });

  // Calculate Total Score
  const totalScore = answers.reduce((sum, item) => sum + item.score, 0);

  // Determine Category
  let category: NaranjoEvaluationResult['category'] = 'Doubtful';
  if (totalScore >= 9) category = 'Definite';
  else if (totalScore >= 5) category = 'Probable';
  else if (totalScore >= 1) category = 'Possible';

  return {
    score: totalScore,
    category,
    answers,
    grounded: aiResult.grounded,
    selfConsistent: aiResult.selfConsistent
  };
}
