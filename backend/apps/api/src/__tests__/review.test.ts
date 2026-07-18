import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { resetMockDb, casesTable, caseEventsTable } from '../config/mockDb';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-secret-key-at-least-32-characters-long';
const TENANT_ID = 'de000000-0000-0000-0000-000000000001';

// Mock session user contexts
const REPORTER_JWT = jwt.sign({ id: '55555555-5555-5555-5555-555555555555', role: 'reporter', tenantId: TENANT_ID, email: 'reporter@pharmasafe.io' }, JWT_SECRET);
const REVIEWER_JWT = jwt.sign({ id: '66666666-6666-6666-6666-666666666666', role: 'reviewer', tenantId: TENANT_ID, email: 'reviewer@pharmasafe.io' }, JWT_SECRET);
const ADMIN_JWT = jwt.sign({ id: '77777777-7777-7777-7777-777777777777', role: 'admin', tenantId: TENANT_ID, email: 'admin@pharmasafe.io' }, JWT_SECRET);

describe('PharmaSafe Phase 4 - Review, Audit & Export Tests', () => {
  const caseId = 'c0000001-3333-3333-3333-333333333333';
  const tenantId = 'de000000-0000-0000-0000-000000000001';

  beforeEach(() => {
    resetMockDb();

    // Seed a case for testing review flow
    casesTable.push({
      id: caseId,
      tenant_id: tenantId,
      patient_id: 'p0000001-2222-2222-2222-222222222222',
      drug_id: 'd0000001-0000-0000-0000-000000000001',
      reporter_id: '55555555-5555-5555-5555-555555555555',
      reporter_type: 'healthcare_professional',
      dosage: '10mg',
      onset_date: new Date('2026-07-10'),
      narrative: 'Patient developed mild rash after drug exposure.',
      hospitalization: false,
      life_threatening: false,
      disability: false,
      status: 'triaged',
      priority: 'medium',
      source: 'manual',
      naranjo_score: 3,
      naranjo_category: 'Possible',
      naranjo_answers: [
        { questionId: 1, question: 'Reports?', answer: 'no', score: 0, source: 'llm_inferred' },
        { questionId: 2, question: 'Onset?', answer: 'yes', score: 2, source: 'llm_inferred' },
        { questionId: 5, question: 'Alternative?', answer: 'no', score: 2, source: 'llm_inferred' }
      ],
      snomed_candidates: [
        { code: '271795006', term: 'Skin rash', confidence: 0.9, selected: false, source: 'llm_inferred' }
      ],
      ai_summary: 'AI draft, unreviewed: Patient experienced rash.',
      created_at: new Date(),
      updated_at: new Date()
    });
  });

  describe('POST /cases/:id/review/confirm', () => {
    const payload = {
      seriousness: ['hospitalization'],
      snomedCandidates: [
        { code: '271795006', term: 'Skin rash', confidence: 0.9, selected: true, source: 'llm_inferred' }
      ],
      naranjoAnswers: [
        { questionId: 1, question: 'Reports?', answer: 'yes', score: 1 }, // Changed from no to yes (+1)
        { questionId: 2, question: 'Onset?', answer: 'yes', score: 2 },
        { questionId: 5, question: 'Alternative?', answer: 'no', score: 2 }
      ]
    };

    it('should reject review confirmation from reporters (403)', async () => {
      const res = await request(app)
        .post(`/cases/${caseId}/review/confirm`)
        .set('Authorization', `Bearer ${REPORTER_JWT}`)
        .send(payload);

      expect(res.status).toBe(403);
    });

    it('should allow reviewers to confirm review, re-tally scores, and set reviewer_confirmed tags', async () => {
      const res = await request(app)
        .post(`/cases/${caseId}/review/confirm`)
        .set('Authorization', `Bearer ${REVIEWER_JWT}`)
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('reviewed');

      // Verify case updates in mock DB
      const updatedCase = casesTable.find(c => c.id === caseId);
      expect(updatedCase).toBeDefined();
      expect(updatedCase?.status).toBe('reviewed');
      expect(updatedCase?.hospitalization).toBe(true); // Updated
      expect(updatedCase?.naranjo_score).toBe(5); // 1 + 2 + 2 = 5
      expect(updatedCase?.naranjo_category).toBe('Probable'); // 5 falls into Probable
      
      // Check tagging source
      expect(updatedCase?.naranjo_answers?.[0].source).toBe('reviewer_confirmed');
      expect(updatedCase?.snomed_candidates?.[0].source).toBe('reviewer_confirmed');

      // Verify audit trail write
      const auditEvent = caseEventsTable.find(e => e.case_id === caseId && e.action === 'review_confirmed');
      expect(auditEvent).toBeDefined();
      expect(auditEvent?.actor_type).toBe('reviewer');
    });
  });

  describe('XML Exporters (E2B / PvPI)', () => {
    it('should generate valid E2B(R3) XML download', async () => {
      const res = await request(app)
        .get(`/cases/${caseId}/export/e2b`)
        .set('Authorization', `Bearer ${REVIEWER_JWT}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/xml');
      expect(res.text).toContain('<?xml');
      expect(res.text).toContain('<ichicsr');
      expect(res.text).toContain('<safetyreportid>');
      expect(res.text).toContain('rash');
    });

    it('should generate valid PvPI XML download', async () => {
      const res = await request(app)
        .get(`/cases/${caseId}/export/pvpi`)
        .set('Authorization', `Bearer ${REVIEWER_JWT}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/xml');
      expect(res.text).toContain('<?xml');
      expect(res.text).toContain('<pvpiicsr');
      expect(res.text).toContain('<nationalprogramcode>');
    });
  });
});
