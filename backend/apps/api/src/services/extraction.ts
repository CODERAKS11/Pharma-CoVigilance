import { z } from 'zod';
import { callGuardedAI } from './ai';
import { naranjoAnalysisSchema } from './naranjo';

export interface NarrativeExtractionResult {
  data: any;
  grounded: boolean;
  selfConsistent: boolean;
  redactedNarrative: string;
  rawResponse: string;
}

/**
 * Extracts Naranjo-relevant evidence from a narrative using a narrow schema-constrained guarded LLM call.
 * This stage is intentionally separate from scoring so the pipeline can keep extraction and causality math distinct.
 */
export async function extractNarrativeSignals(
  narrative: string,
  onsetDate?: Date | string | null
): Promise<NarrativeExtractionResult> {
  const prompt = `Extract only the following structured evidence fields from the narrative:
1. conclusive reports on this reaction
2. did the adverse event appear after the suspected drug was administered
3. did the adverse reaction improve when the drug was discontinued or a specific antagonist was administered
4. did the adverse reaction reappear when the drug was readministered
5. are there alternative causes that could on their own have caused the reaction
6. did the patient have a similar reaction to the same or similar drugs in any previous exposure
7. was the adverse event confirmed by any objective evidence

For each field, return only "yes", "no", or "unknown" and provide the exact supporting quote from the narrative in the matching Quote field. Do not calculate a score.`;

  return callGuardedAI({
    prompt,
    narrative,
    responseSchema: naranjoAnalysisSchema,
    onsetDate,
    temperature: 0.1
  }) as Promise<NarrativeExtractionResult>;
}