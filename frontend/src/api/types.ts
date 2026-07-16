/* ── API Types ─────────────────────────────────── */

export type UserRole = 'Reporter' | 'Reviewer' | 'Admin';

export type SourceType = 'structured_field' | 'llm_inferred' | 'reviewer_confirmed';

export type CaseStatus = 'new' | 'processing' | 'triaged' | 'under_review' | 'reviewed' | 'closed';

export type SeverityCategory = 'Definite' | 'Probable' | 'Possible' | 'Doubtful';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type SeriousnessFlag = 'hospitalization' | 'life_threatening' | 'disability' | 'death' | 'other';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
}

export interface NaranjoAnswer {
  question: string;
  questionId: number;
  answer: 'yes' | 'no' | 'unknown';
  score: number;
  source: SourceType;
  confidence?: number;
  supportingQuote?: string;
}

export interface SnomedCandidate {
  code: string;
  term: string;
  confidence: number;
  selected: boolean;
  source: SourceType;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  actorType: 'System' | 'AI Pipeline' | 'Reviewer' | 'Admin';
  action: string;
  details?: string;
  caseId?: string;
}

export interface CaseRecord {
  id: string;
  caseNumber: string;
  status: CaseStatus;
  priority: Priority;
  patientAge: number;
  patientSex: 'Male' | 'Female' | 'Other';
  drugName: string;
  drugDosage: string;
  indication: string;
  adverseEvent: string;
  narrative: string;
  seriousness: SeriousnessFlag[];
  onsetDate: string;
  reportDate: string;
  reporterType: string;
  naranjoScore: number;
  naranjoCategory: SeverityCategory;
  naranjoAnswers: NaranjoAnswer[];
  snomedCandidates: SnomedCandidate[];
  auditTrail: AuditEntry[];
  assignedReviewer?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardStats {
  casesProcessed: number;
  avgTimeToReview: string;
  duplicateRate: number;
  duplicatePrecision: number;
  duplicateRecall: number;
  naranjoAgreementRate: number;
  topDrugs: { name: string; count: number }[];
  severityDistribution: { category: SeverityCategory; count: number }[];
  volumeOverTime: { date: string; count: number }[];
}

export interface ExportRecord {
  caseId: string;
  caseNumber: string;
  drugName: string;
  adverseEvent: string;
  status: CaseStatus;
  naranjoCategory: SeverityCategory;
  reviewedAt: string;
  exportedAt?: string;
}
