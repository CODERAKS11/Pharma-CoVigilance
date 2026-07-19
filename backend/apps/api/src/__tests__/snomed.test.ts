import { initSnomed, searchSnomed } from '../services/snomed';
import { generateNarrativeDraft } from '../services/narrative';
import { initQueue, enqueueCaseJob, closeQueue } from '../services/queue';
import { resetMockDb, casesTable, patientsTable } from '../config/mockDb';

describe('PharmaSafe Phase 3 - Coding & Triage Tests', () => {
  beforeEach(async () => {
    resetMockDb();
    jest.spyOn(global, 'fetch').mockImplementation((url) => {
      if (typeof url === 'string' && url.includes('qdrant.io')) {
        return Promise.reject(new Error('Qdrant offline for test'));
      }
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
    });
    await initSnomed();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('SNOMED CT Matching Engine', () => {
    it('should match symptoms using fuzzy lexical matching', async () => {
      // Test exact matches and synonym mappings
      const sjsResult = await searchSnomed('blistering skin rash');
      expect(sjsResult.length).toBeGreaterThan(0);
      expect(sjsResult[0].code).toBe('73442001'); // Stevens-Johnson syndrome code
      
      const nauseaResult = await searchSnomed('queasy');
      expect(nauseaResult.length).toBeGreaterThan(0);
      expect(nauseaResult[0].code).toBe('80449002'); // Nausea code
    });

    it('should filter out low confidence results and return top 3', async () => {
      const results = await searchSnomed('severe blistering skin rash and emesis and cephalgia');
      expect(results.length).toBeLessThanOrEqual(3);
      
      const codes = results.map(r => r.code);
      expect(codes).toContain('73442001'); // SJS
      expect(codes).toContain('422400008'); // Vomiting/Emesis
    });
  });

  describe('AI Narrative draft summaries', () => {
    it('should generate a summary paragraph marked as AI draft', async () => {
      const caseRecord = {
        patientAge: 45,
        patientSex: 'male',
        drugName: 'Metformin',
        dosage: '500mg',
        onsetDate: '2026-07-10',
        narrative: 'Patient developed lactic acidosis after taking Metformin.',
        naranjoScore: 6,
        naranjoCategory: 'Probable'
      };

      const summary = await generateNarrativeDraft(caseRecord);
      
      expect(summary).toContain('AI draft, unreviewed:');
      expect(summary).toContain('45-year-old');
      expect(summary).toContain('male');
      expect(summary).toContain('Metformin');
      expect(summary).toContain('Naranjo score of 6');
    });
  });

  describe('End-to-End Pipeline Execution (Phase 3)', () => {
    const tenantId = 'de000000-0000-0000-0000-000000000001';

    beforeEach(async () => {
      await initQueue();
    });

    afterEach(async () => {
      await closeQueue();
    });

    it('should execute validity check, deduplication, triage, naranjo scoring, snomed coding, and summary drafting', async () => {
      const drugId = 'd0000001-0000-0000-0000-000000000001';
      
      // 1. Seed patient
      patientsTable.push({
        id: 'p0000001-2222-2222-2222-222222222222',
        tenant_id: tenantId,
        age: 35,
        sex: 'female',
        created_at: new Date()
      });

      // 2. Insert case
      const caseId = 'c0000001-3333-3333-3333-333333333333';
      casesTable.push({
        id: caseId,
        tenant_id: tenantId,
        patient_id: 'p0000001-2222-2222-2222-222222222222',
        drug_id: drugId,
        reporter_id: '55555555-5555-5555-5555-555555555555',
        reporter_type: 'healthcare_professional',
        dosage: '10mg',
        onset_date: new Date(),
        narrative: 'Patient developed blistering skin rash and feeling sick.',
        hospitalization: true,
        life_threatening: false,
        disability: false,
        status: 'intake',
        priority: null,
        source: 'manual',
        created_at: new Date(),
        updated_at: new Date()
      });

      // 3. Trigger processing
      await enqueueCaseJob(caseId);

      // Wait for mock queue async execution
      await new Promise(r => setTimeout(r, 200));

      const updatedCase = casesTable.find(c => c.id === caseId);
      expect(updatedCase).toBeDefined();

      // Check Naranjo fields are saved
      expect(updatedCase?.naranjo_score).toBeDefined();
      expect(updatedCase?.naranjo_category).toBeDefined();
      expect(updatedCase?.naranjo_answers).toBeDefined();

      // Check SNOMED candidates are saved
      expect(updatedCase?.snomed_candidates).toBeDefined();
      expect(updatedCase?.snomed_candidates?.length).toBeGreaterThan(0);
      
      const codes = (updatedCase?.snomed_candidates as any[]).map(c => c.code);
      expect(codes).toContain('73442001'); // SJS / blistering skin rash

      // Check AI summary draft is saved
      expect(updatedCase?.ai_summary).toBeDefined();
      expect(updatedCase?.ai_summary).toContain('AI draft, unreviewed:');
    });
  });
});
