import { z } from 'zod';

export const createCaseSchema = z.object({
  patientAge: z.number().int().min(0).max(120).nullable().optional(),
  patientSex: z.enum(['male', 'female', 'other', 'unknown']).default('unknown'),
  drugName: z.string().trim().min(1, 'Drug name is required'),
  dosage: z.string().trim().nullable().optional(),
  onsetDate: z.string().refine((val) => {
    if (!val) return true;
    const date = new Date(val);
    return !isNaN(date.getTime());
  }, { message: 'Invalid onset date format' }).nullable().optional(),
  narrative: z.string().trim().min(5, 'Narrative must be at least 5 characters long'),
  hospitalization: z.boolean().default(false),
  lifeThreatening: z.boolean().default(false),
  disability: z.boolean().default(false),
  reporterType: z.enum(['healthcare_professional', 'patient', 'caregiver', 'manufacturer'])
});

export type CreateCaseInput = z.infer<typeof createCaseSchema>;

export const updateStatusSchema = z.object({
  status: z.enum(['intake', 'processing', 'triaged', 'needs_review', 'reviewed', 'exported', 'rejected'])
});
