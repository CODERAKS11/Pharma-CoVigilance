import type { CaseRecord, DashboardStats, AuditEntry, ExportRecord, NaranjoAnswer, SnomedCandidate } from './types';

/* ── Naranjo Questions ──────────────────────────── */
const naranjoQuestions = [
  'Are there previous conclusive reports on this reaction?',
  'Did the adverse event appear after the suspected drug was administered?',
  'Did the adverse reaction improve when the drug was discontinued?',
  'Did the adverse reaction reappear when the drug was re-administered?',
  'Are there alternative causes that could have caused the reaction?',
  'Did the reaction reappear when a placebo was given?',
  'Was the drug detected in the blood in concentrations known to be toxic?',
  'Was the reaction more severe when the dose was increased?',
  'Did the patient have a similar reaction to the same or similar drugs before?',
  'Was the adverse event confirmed by any objective evidence?',
];

function makeNaranjoAnswers(score: number): NaranjoAnswer[] {
  const answers: ('yes' | 'no' | 'unknown')[] = [];
  const sources: ('structured_field' | 'llm_inferred' | 'reviewer_confirmed')[] = [];
  
  // Generate answers that roughly sum to the given score
  let remaining = score;
  for (let i = 0; i < 10; i++) {
    if (remaining >= 2 && Math.random() > 0.3) {
      answers.push('yes');
      remaining -= (i === 3 ? 2 : i === 4 ? -1 : [0, 1, 2, 7, 8, 9].includes(i) ? 1 : 1);
      sources.push(Math.random() > 0.5 ? 'llm_inferred' : 'structured_field');
    } else if (remaining <= 0 && Math.random() > 0.4) {
      answers.push('no');
      sources.push('structured_field');
    } else {
      answers.push('unknown');
      sources.push('llm_inferred');
    }
  }

  return naranjoQuestions.map((q, i) => ({
    question: q,
    questionId: i + 1,
    answer: answers[i],
    score: answers[i] === 'yes' ? (i === 4 ? -1 : i === 5 ? -1 : [0, 1, 2].includes(i) ? 1 : 2) : answers[i] === 'no' ? 0 : 0,
    source: sources[i],
    confidence: sources[i] === 'llm_inferred' ? Math.round(70 + Math.random() * 25) / 100 : undefined,
    supportingQuote: sources[i] === 'llm_inferred' 
      ? `"${['Patient reported significant improvement after drug discontinuation', 'Timeline consistent with drug administration on day 3', 'Prior history of similar reaction documented in medical records', 'No alternative etiology identified in clinical workup', 'Blood levels were within therapeutic range'][i % 5]}"`
      : undefined,
  }));
}

function makeSnomedCandidates(event: string): SnomedCandidate[] {
  const candidates: Record<string, SnomedCandidate[]> = {
    'Hepatotoxicity': [
      { code: '197270009', term: 'Drug-induced hepatitis', confidence: 0.92, selected: true, source: 'llm_inferred' },
      { code: '235856003', term: 'Hepatotoxicity', confidence: 0.87, selected: false, source: 'llm_inferred' },
      { code: '76783007', term: 'Chronic hepatitis', confidence: 0.34, selected: false, source: 'llm_inferred' },
    ],
    'Stevens-Johnson Syndrome': [
      { code: '73442001', term: 'Stevens-Johnson syndrome', confidence: 0.96, selected: true, source: 'llm_inferred' },
      { code: '238731009', term: 'Toxic epidermal necrolysis', confidence: 0.72, selected: false, source: 'llm_inferred' },
      { code: '200948004', term: 'Erythema multiforme', confidence: 0.45, selected: false, source: 'llm_inferred' },
    ],
    'Rhabdomyolysis': [
      { code: '240131006', term: 'Drug-induced rhabdomyolysis', confidence: 0.89, selected: true, source: 'llm_inferred' },
      { code: '44730006', term: 'Rhabdomyolysis', confidence: 0.85, selected: false, source: 'llm_inferred' },
      { code: '68962001', term: 'Myopathy', confidence: 0.41, selected: false, source: 'llm_inferred' },
    ],
  };
  return candidates[event] || [
    { code: '404684003', term: event, confidence: 0.88, selected: true, source: 'llm_inferred' },
    { code: '55607006', term: 'Problem', confidence: 0.52, selected: false, source: 'llm_inferred' },
    { code: '64572001', term: 'Disease', confidence: 0.31, selected: false, source: 'llm_inferred' },
  ];
}

/* ── Mock Cases ─────────────────────────────────── */
export const mockCases: CaseRecord[] = [
  {
    id: 'case-001',
    caseNumber: 'PV-2025-001847',
    status: 'triaged',
    priority: 'critical',
    patientAge: 67,
    patientSex: 'Male',
    drugName: 'Amoxicillin',
    drugDosage: '500mg TID',
    indication: 'Community-acquired pneumonia',
    adverseEvent: 'Stevens-Johnson Syndrome',
    narrative: 'A 67-year-old male patient was prescribed Amoxicillin 500mg three times daily for community-acquired pneumonia. On Day 5 of therapy, the patient developed diffuse erythematous macules progressing to vesicles and bullae involving approximately 15% of total body surface area. Mucosal involvement included oral cavity and conjunctivae bilaterally. The patient was hospitalized and Amoxicillin was immediately discontinued. Dermatology consultation confirmed a clinical diagnosis of Stevens-Johnson Syndrome. The patient was managed with supportive care including IV fluids and wound care. Skin biopsy showed full-thickness epidermal necrosis consistent with SJS. The patient showed gradual improvement over a 14-day hospitalization period.',
    seriousness: ['hospitalization', 'life_threatening'],
    onsetDate: '2025-07-10',
    reportDate: '2025-07-12',
    reporterType: 'Healthcare Professional',
    naranjoScore: 8,
    naranjoCategory: 'Probable',
    naranjoAnswers: makeNaranjoAnswers(8),
    snomedCandidates: makeSnomedCandidates('Stevens-Johnson Syndrome'),
    auditTrail: [
      { id: 'a1', timestamp: '2025-07-12T09:15:00Z', actor: 'System', actorType: 'System', action: 'Case created from reporter submission' },
      { id: 'a2', timestamp: '2025-07-12T09:15:05Z', actor: 'AI Pipeline', actorType: 'AI Pipeline', action: 'NLP extraction completed', details: 'Extracted 12 structured fields from narrative' },
      { id: 'a3', timestamp: '2025-07-12T09:15:08Z', actor: 'AI Pipeline', actorType: 'AI Pipeline', action: 'Naranjo algorithm scored: 8 (Probable)', details: 'Based on 7 LLM-inferred answers, 3 structured fields' },
      { id: 'a4', timestamp: '2025-07-12T09:15:10Z', actor: 'AI Pipeline', actorType: 'AI Pipeline', action: 'SNOMED CT coding completed', details: 'Top candidate: Stevens-Johnson syndrome (73442001) at 96% confidence' },
      { id: 'a5', timestamp: '2025-07-12T09:16:00Z', actor: 'System', actorType: 'System', action: 'Case triaged as Critical priority' },
    ],
    createdAt: '2025-07-12T09:15:00Z',
    updatedAt: '2025-07-12T09:16:00Z',
  },
  {
    id: 'case-002',
    caseNumber: 'PV-2025-001848',
    status: 'under_review',
    priority: 'high',
    patientAge: 45,
    patientSex: 'Female',
    drugName: 'Atorvastatin',
    drugDosage: '40mg QD',
    indication: 'Hypercholesterolemia',
    adverseEvent: 'Rhabdomyolysis',
    narrative: 'A 45-year-old female patient on Atorvastatin 40mg daily for hypercholesterolemia presented with progressive proximal muscle weakness and dark brown urine over 3 days. Creatine kinase was markedly elevated at 15,200 U/L (normal <200). Urinalysis positive for myoglobin. Renal function showed acute kidney injury with creatinine rising from baseline 0.9 to 2.8 mg/dL. Atorvastatin was discontinued and the patient was admitted for aggressive IV hydration. The patient was not on any other known myotoxic medications. CK trended down after 48 hours of IV fluids and drug discontinuation.',
    seriousness: ['hospitalization'],
    onsetDate: '2025-07-08',
    reportDate: '2025-07-11',
    reporterType: 'Healthcare Professional',
    naranjoScore: 7,
    naranjoCategory: 'Probable',
    naranjoAnswers: makeNaranjoAnswers(7),
    snomedCandidates: makeSnomedCandidates('Rhabdomyolysis'),
    auditTrail: [
      { id: 'b1', timestamp: '2025-07-11T14:30:00Z', actor: 'System', actorType: 'System', action: 'Case created from reporter submission' },
      { id: 'b2', timestamp: '2025-07-11T14:30:04Z', actor: 'AI Pipeline', actorType: 'AI Pipeline', action: 'NLP extraction completed', details: 'Extracted 10 structured fields from narrative' },
      { id: 'b3', timestamp: '2025-07-11T14:30:07Z', actor: 'AI Pipeline', actorType: 'AI Pipeline', action: 'Naranjo algorithm scored: 7 (Probable)' },
      { id: 'b4', timestamp: '2025-07-11T14:30:09Z', actor: 'AI Pipeline', actorType: 'AI Pipeline', action: 'SNOMED CT coding completed' },
      { id: 'b5', timestamp: '2025-07-11T14:31:00Z', actor: 'System', actorType: 'System', action: 'Case triaged as High priority' },
      { id: 'b6', timestamp: '2025-07-11T15:00:00Z', actor: 'Dr. Sarah Chen', actorType: 'Reviewer', action: 'Case opened for review' },
    ],
    assignedReviewer: 'Dr. Sarah Chen',
    createdAt: '2025-07-11T14:30:00Z',
    updatedAt: '2025-07-11T15:00:00Z',
  },
  {
    id: 'case-003',
    caseNumber: 'PV-2025-001849',
    status: 'reviewed',
    priority: 'medium',
    patientAge: 52,
    patientSex: 'Male',
    drugName: 'Metformin',
    drugDosage: '1000mg BID',
    indication: 'Type 2 Diabetes',
    adverseEvent: 'Lactic Acidosis',
    narrative: 'A 52-year-old male patient with type 2 diabetes and chronic kidney disease (stage 3a, eGFR 52) was continued on Metformin 1000mg twice daily despite declining renal function. He presented to the ED with nausea, vomiting, abdominal pain, and altered mental status. Arterial blood gas revealed pH 7.15 with lactate of 14.2 mmol/L. Metformin level was elevated. The patient required ICU admission with bicarbonate infusion and temporary hemodialysis. Metformin was permanently discontinued and the patient transitioned to insulin therapy.',
    seriousness: ['hospitalization', 'life_threatening'],
    onsetDate: '2025-07-05',
    reportDate: '2025-07-09',
    reporterType: 'Healthcare Professional',
    naranjoScore: 9,
    naranjoCategory: 'Definite',
    naranjoAnswers: makeNaranjoAnswers(9),
    snomedCandidates: makeSnomedCandidates('Lactic Acidosis'),
    auditTrail: [
      { id: 'c1', timestamp: '2025-07-09T10:00:00Z', actor: 'System', actorType: 'System', action: 'Case created from reporter submission' },
      { id: 'c2', timestamp: '2025-07-09T10:00:05Z', actor: 'AI Pipeline', actorType: 'AI Pipeline', action: 'NLP extraction completed' },
      { id: 'c3', timestamp: '2025-07-09T10:00:08Z', actor: 'AI Pipeline', actorType: 'AI Pipeline', action: 'Naranjo algorithm scored: 9 (Definite)' },
      { id: 'c4', timestamp: '2025-07-09T10:01:00Z', actor: 'System', actorType: 'System', action: 'Case triaged as Medium priority' },
      { id: 'c5', timestamp: '2025-07-09T11:30:00Z', actor: 'Dr. James Okafor', actorType: 'Reviewer', action: 'Case opened for review' },
      { id: 'c6', timestamp: '2025-07-09T11:45:00Z', actor: 'Dr. James Okafor', actorType: 'Reviewer', action: 'Naranjo score confirmed — no changes', details: 'AI assessment aligns with clinical evidence' },
      { id: 'c7', timestamp: '2025-07-09T11:46:00Z', actor: 'Dr. James Okafor', actorType: 'Reviewer', action: 'Case marked as Reviewed' },
    ],
    assignedReviewer: 'Dr. James Okafor',
    reviewedAt: '2025-07-09T11:46:00Z',
    createdAt: '2025-07-09T10:00:00Z',
    updatedAt: '2025-07-09T11:46:00Z',
  },
  {
    id: 'case-004',
    caseNumber: 'PV-2025-001850',
    status: 'triaged',
    priority: 'high',
    patientAge: 34,
    patientSex: 'Female',
    drugName: 'Isoniazid',
    drugDosage: '300mg QD',
    indication: 'Latent TB prophylaxis',
    adverseEvent: 'Hepatotoxicity',
    narrative: 'A 34-year-old female patient was started on Isoniazid 300mg daily for latent tuberculosis prophylaxis. At the 6-week follow-up, routine liver function tests revealed ALT 380 U/L and AST 290 U/L (normal <40). The patient was asymptomatic at this time. Isoniazid was held and repeat LFTs one week later showed ALT 180 U/L, trending down. The patient denied alcohol use and viral hepatitis serologies were negative. Isoniazid was not rechallenged due to the degree of transaminase elevation.',
    seriousness: ['other'],
    onsetDate: '2025-07-01',
    reportDate: '2025-07-10',
    reporterType: 'Healthcare Professional',
    naranjoScore: 6,
    naranjoCategory: 'Probable',
    naranjoAnswers: makeNaranjoAnswers(6),
    snomedCandidates: makeSnomedCandidates('Hepatotoxicity'),
    auditTrail: [
      { id: 'd1', timestamp: '2025-07-10T08:00:00Z', actor: 'System', actorType: 'System', action: 'Case created from reporter submission' },
      { id: 'd2', timestamp: '2025-07-10T08:00:05Z', actor: 'AI Pipeline', actorType: 'AI Pipeline', action: 'NLP extraction completed' },
      { id: 'd3', timestamp: '2025-07-10T08:00:08Z', actor: 'AI Pipeline', actorType: 'AI Pipeline', action: 'Naranjo algorithm scored: 6 (Probable)' },
      { id: 'd4', timestamp: '2025-07-10T08:01:00Z', actor: 'System', actorType: 'System', action: 'Case triaged as High priority' },
    ],
    createdAt: '2025-07-10T08:00:00Z',
    updatedAt: '2025-07-10T08:01:00Z',
  },
  {
    id: 'case-005',
    caseNumber: 'PV-2025-001851',
    status: 'new',
    priority: 'low',
    patientAge: 29,
    patientSex: 'Male',
    drugName: 'Ibuprofen',
    drugDosage: '400mg TID',
    indication: 'Post-operative pain',
    adverseEvent: 'Gastric Ulcer',
    narrative: 'A 29-year-old male patient took Ibuprofen 400mg three times daily for post-operative dental pain for 10 days. He subsequently developed epigastric pain, nausea, and one episode of hematemesis. Upper endoscopy revealed a 1.5cm gastric ulcer in the antrum without active bleeding. H. pylori testing was negative. Ibuprofen was discontinued and the patient was started on a proton pump inhibitor. Follow-up endoscopy at 6 weeks showed complete ulcer healing.',
    seriousness: ['hospitalization'],
    onsetDate: '2025-07-06',
    reportDate: '2025-07-12',
    reporterType: 'Patient',
    naranjoScore: 4,
    naranjoCategory: 'Possible',
    naranjoAnswers: makeNaranjoAnswers(4),
    snomedCandidates: makeSnomedCandidates('Gastric Ulcer'),
    auditTrail: [
      { id: 'e1', timestamp: '2025-07-12T11:00:00Z', actor: 'System', actorType: 'System', action: 'Case created from patient self-report' },
      { id: 'e2', timestamp: '2025-07-12T11:00:04Z', actor: 'AI Pipeline', actorType: 'AI Pipeline', action: 'NLP extraction completed' },
      { id: 'e3', timestamp: '2025-07-12T11:00:07Z', actor: 'AI Pipeline', actorType: 'AI Pipeline', action: 'Naranjo algorithm scored: 4 (Possible)' },
    ],
    createdAt: '2025-07-12T11:00:00Z',
    updatedAt: '2025-07-12T11:00:07Z',
  },
  {
    id: 'case-006',
    caseNumber: 'PV-2025-001852',
    status: 'processing',
    priority: 'medium',
    patientAge: 71,
    patientSex: 'Female',
    drugName: 'Warfarin',
    drugDosage: '5mg QD',
    indication: 'Atrial fibrillation',
    adverseEvent: 'GI Bleeding',
    narrative: 'A 71-year-old female on warfarin 5mg daily for atrial fibrillation presented with melena and hemoglobin drop from 12.1 to 8.4 g/dL. INR was supratherapeutic at 4.8. Colonoscopy revealed a bleeding diverticulum in the sigmoid colon. The patient received vitamin K and 2 units of packed red blood cells. Warfarin was held and later restarted at a reduced dose after gastroenterology consultation.',
    seriousness: ['hospitalization'],
    onsetDate: '2025-07-09',
    reportDate: '2025-07-12',
    reporterType: 'Healthcare Professional',
    naranjoScore: 5,
    naranjoCategory: 'Probable',
    naranjoAnswers: makeNaranjoAnswers(5),
    snomedCandidates: makeSnomedCandidates('GI Bleeding'),
    auditTrail: [
      { id: 'f1', timestamp: '2025-07-12T13:00:00Z', actor: 'System', actorType: 'System', action: 'Case created from reporter submission' },
      { id: 'f2', timestamp: '2025-07-12T13:00:03Z', actor: 'AI Pipeline', actorType: 'AI Pipeline', action: 'Processing narrative — NLP extraction in progress' },
    ],
    createdAt: '2025-07-12T13:00:00Z',
    updatedAt: '2025-07-12T13:00:03Z',
  },
  {
    id: 'case-007',
    caseNumber: 'PV-2025-001853',
    status: 'reviewed',
    priority: 'low',
    patientAge: 38,
    patientSex: 'Female',
    drugName: 'Lisinopril',
    drugDosage: '10mg QD',
    indication: 'Hypertension',
    adverseEvent: 'Angioedema',
    narrative: 'A 38-year-old female recently started on Lisinopril 10mg daily for newly diagnosed hypertension developed progressive lip and tongue swelling approximately 4 hours after the first dose. She presented to the ED with difficulty swallowing but no stridor. Lisinopril was discontinued and she was treated with epinephrine, diphenhydramine, and dexamethasone. Swelling resolved over 8 hours. She was observed overnight and discharged on an alternative antihypertensive (amlodipine).',
    seriousness: ['hospitalization'],
    onsetDate: '2025-07-11',
    reportDate: '2025-07-12',
    reporterType: 'Healthcare Professional',
    naranjoScore: 2,
    naranjoCategory: 'Doubtful',
    naranjoAnswers: makeNaranjoAnswers(2),
    snomedCandidates: makeSnomedCandidates('Angioedema'),
    auditTrail: [
      { id: 'g1', timestamp: '2025-07-12T15:00:00Z', actor: 'System', actorType: 'System', action: 'Case created from reporter submission' },
      { id: 'g2', timestamp: '2025-07-12T15:00:05Z', actor: 'AI Pipeline', actorType: 'AI Pipeline', action: 'NLP extraction completed' },
      { id: 'g3', timestamp: '2025-07-12T15:00:08Z', actor: 'AI Pipeline', actorType: 'AI Pipeline', action: 'Naranjo algorithm scored: 2 (Doubtful)' },
      { id: 'g4', timestamp: '2025-07-12T15:30:00Z', actor: 'Dr. Sarah Chen', actorType: 'Reviewer', action: 'Score overridden: 2 → 7 (Probable)', details: 'Strong temporal relationship and known ACE-inhibitor class effect support higher causality' },
      { id: 'g5', timestamp: '2025-07-12T15:31:00Z', actor: 'Dr. Sarah Chen', actorType: 'Reviewer', action: 'Case marked as Reviewed' },
    ],
    assignedReviewer: 'Dr. Sarah Chen',
    reviewedAt: '2025-07-12T15:31:00Z',
    createdAt: '2025-07-12T15:00:00Z',
    updatedAt: '2025-07-12T15:31:00Z',
  },
  {
    id: 'case-008',
    caseNumber: 'PV-2025-001854',
    status: 'triaged',
    priority: 'medium',
    patientAge: 55,
    patientSex: 'Male',
    drugName: 'Ciprofloxacin',
    drugDosage: '500mg BID',
    indication: 'Urinary tract infection',
    adverseEvent: 'Tendon Rupture',
    narrative: 'A 55-year-old male patient prescribed Ciprofloxacin 500mg twice daily for a complicated UTI experienced sudden onset of right Achilles tendon pain and swelling on Day 8 of therapy. MRI confirmed a partial Achilles tendon tear. The patient has a history of concurrent corticosteroid use (prednisone 10mg daily for COPD) which is a known risk factor for fluoroquinolone-associated tendinopathy. Ciprofloxacin was discontinued immediately.',
    seriousness: ['disability'],
    onsetDate: '2025-07-07',
    reportDate: '2025-07-11',
    reporterType: 'Healthcare Professional',
    naranjoScore: 7,
    naranjoCategory: 'Probable',
    naranjoAnswers: makeNaranjoAnswers(7),
    snomedCandidates: makeSnomedCandidates('Tendon Rupture'),
    auditTrail: [
      { id: 'h1', timestamp: '2025-07-11T16:00:00Z', actor: 'System', actorType: 'System', action: 'Case created from reporter submission' },
      { id: 'h2', timestamp: '2025-07-11T16:00:04Z', actor: 'AI Pipeline', actorType: 'AI Pipeline', action: 'NLP extraction completed' },
      { id: 'h3', timestamp: '2025-07-11T16:00:07Z', actor: 'AI Pipeline', actorType: 'AI Pipeline', action: 'Naranjo algorithm scored: 7 (Probable)' },
      { id: 'h4', timestamp: '2025-07-11T16:00:10Z', actor: 'AI Pipeline', actorType: 'AI Pipeline', action: 'Duplicate check: No duplicates found' },
    ],
    createdAt: '2025-07-11T16:00:00Z',
    updatedAt: '2025-07-11T16:00:10Z',
  },
];

/* ── Dashboard Stats ────────────────────────────── */
export const mockDashboardStats: DashboardStats = {
  casesProcessed: 1247,
  avgTimeToReview: '4.2h',
  duplicateRate: 8.3,
  duplicatePrecision: 94.2,
  duplicateRecall: 87.6,
  naranjoAgreementRate: 91.4,
  topDrugs: [
    { name: 'Amoxicillin', count: 89 },
    { name: 'Atorvastatin', count: 76 },
    { name: 'Metformin', count: 64 },
    { name: 'Warfarin', count: 58 },
    { name: 'Ciprofloxacin', count: 45 },
    { name: 'Lisinopril', count: 42 },
    { name: 'Ibuprofen', count: 38 },
    { name: 'Isoniazid', count: 31 },
  ],
  severityDistribution: [
    { category: 'Definite', count: 124 },
    { category: 'Probable', count: 487 },
    { category: 'Possible', count: 389 },
    { category: 'Doubtful', count: 247 },
  ],
  volumeOverTime: Array.from({ length: 30 }, (_, i) => ({
    date: new Date(2025, 6, i + 1).toISOString().split('T')[0],
    count: Math.floor(30 + Math.random() * 25),
  })),
};

/* ── System-wide Audit Entries ──────────────────── */
export const mockSystemAudit: AuditEntry[] = mockCases.flatMap(c =>
  c.auditTrail.map(a => ({ ...a, caseId: c.caseNumber }))
).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

/* ── Export Records ─────────────────────────────── */
export const mockExports: ExportRecord[] = mockCases
  .filter(c => c.status === 'reviewed')
  .map(c => ({
    caseId: c.id,
    caseNumber: c.caseNumber,
    drugName: c.drugName,
    adverseEvent: c.adverseEvent,
    status: c.status,
    naranjoCategory: c.naranjoCategory,
    reviewedAt: c.reviewedAt || c.updatedAt,
    exportedAt: Math.random() > 0.5 ? '2025-07-13T10:00:00Z' : undefined,
  }));
