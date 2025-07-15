import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const intakeSchema = z.object({
  drugName: z.string().min(1, 'Drug name is required'),
  dosage: z.string().min(1, 'Dosage is required'),
  dosageUnit: z.string().min(1, 'Unit is required'),
  indication: z.string().min(1, 'Indication is required'),
  patientAge: z.number({ message: 'Age must be a number' }).min(0).max(150, 'Please enter a valid age'),
  patientSex: z.enum(['Male', 'Female', 'Other'] as const, { message: 'Please select patient sex' }),
  onsetDate: z.string().min(1, 'Onset date is required'),
  narrative: z.string().min(20, 'Narrative must be at least 20 characters').max(10000),
  seriousness: z.object({
    hospitalization: z.boolean(),
    life_threatening: z.boolean(),
    disability: z.boolean(),
    death: z.boolean(),
    other: z.boolean(),
  }),
  consentAcknowledged: z.literal(true, {
    message: 'You must acknowledge the data processing notice',
  }),
});

export type IntakeFormData = z.infer<typeof intakeSchema>;
