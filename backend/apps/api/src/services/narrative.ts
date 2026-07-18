import { z } from 'zod';
import { callGuardedAI } from './ai';
import { logger } from '../config/logger';

const summaryResponseSchema = z.object({
  summary: z.string(),
  supportingQuote: z.string().default('')
});

/**
 * Generates an automated case narrative summary draft grounded strictly in the extracted fields.
 */
export async function generateNarrativeDraft(caseRecord: {
  patientAge: number | null;
  patientSex: string;
  drugName: string;
  dosage: string | null;
  onsetDate: Date | string | null;
  narrative: string;
  naranjoScore?: number | null;
  naranjoCategory?: string | null;
}): Promise<string> {
  logger.info('Generating AI narrative case summary draft');

  const ageStr = caseRecord.patientAge ? `${caseRecord.patientAge}-year-old` : 'an';
  const sexStr = caseRecord.patientSex || 'unknown gender';
  const drug = caseRecord.drugName || 'suspected drug';
  const dosage = caseRecord.dosage ? ` at dosage of ${caseRecord.dosage}` : '';
  const score = caseRecord.naranjoScore !== undefined && caseRecord.naranjoScore !== null ? caseRecord.naranjoScore : 'unknown';
  const category = caseRecord.naranjoCategory || 'unknown';

  const prompt = `You are a clinical pharmacovigilance reviewer.
Draft a brief, concise medical case summary paragraph (100-150 words) based ONLY on the provided case narrative.

Structure requirements:
1. Start with the prefix: "AI draft, unreviewed: "
2. Summarize patient demographics (a ${ageStr} ${sexStr}), the suspect drug (${drug}${dosage}), onset time, the specific reactions experienced, and mention that causality assessment computed a Naranjo score of ${score} (${category} causality).
3. Do not include speculation, hypotheses, or external medical facts not present in the narrative.
4. Output must be valid JSON with a single string field: "summary".`;

  try {
    const aiResult = await callGuardedAI({
      prompt,
      narrative: caseRecord.narrative,
      responseSchema: summaryResponseSchema,
      onsetDate: caseRecord.onsetDate,
      temperature: 0.2
    });

    return aiResult.data.summary;
  } catch (err: any) {
    logger.warn({ error: err.message }, 'Failed to generate narrative summary via LLM. Returning structured template fallback.');
    
    // Failsafe structured draft summary template
    const onsetStr = caseRecord.onsetDate ? `on ${new Date(caseRecord.onsetDate).toLocaleDateString()}` : 'post-dose';
    return `AI draft, unreviewed: A ${ageStr} ${sexStr} patient experienced adverse reactions ${onsetStr} after taking ${drug}${dosage}. Causality evaluation calculated a Naranjo score of ${score} indicating a ${category} relationship.`;
  }
}
