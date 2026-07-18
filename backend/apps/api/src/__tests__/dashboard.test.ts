import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { resetMockDb, casesTable } from '../config/mockDb';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-secret-key-at-least-32-characters-long';
const TENANT_ID = 'de000000-0000-0000-0000-000000000001';

const REPORTER_JWT = jwt.sign({ id: '55555555-5555-5555-5555-555555555555', role: 'reporter', tenantId: TENANT_ID, email: 'reporter@pharmasafe.io' }, JWT_SECRET);
const REVIEWER_JWT = jwt.sign({ id: '66666666-6666-6666-6666-666666666666', role: 'reviewer', tenantId: TENANT_ID, email: 'reviewer@pharmasafe.io' }, JWT_SECRET);

describe('PharmaSafe Phase 5 - Evaluation, Hardening & Deployment Tests', () => {
  beforeEach(() => {
    resetMockDb();

    // Seed some cases for stats aggregation
    casesTable.push(
      {
        id: 'c0000001-0000-0000-0000-000000000001',
        tenant_id: TENANT_ID,
        patient_id: 'p1',
        drug_id: 'd1',
        reporter_id: 'rep1',
        reporter_type: 'healthcare_professional',
        dosage: '10mg',
        onset_date: new Date(),
        narrative: 'Patient rash.',
        hospitalization: true,
        life_threatening: false,
        disability: false,
        status: 'reviewed',
        priority: 'high',
        source: 'manual',
        naranjo_score: 5,
        naranjo_category: 'Probable',
        created_at: new Date(Date.now() - 4 * 60 * 60 * 1000), // Created 4 hours ago
        updated_at: new Date() // Reviewed now
      },
      {
        id: 'c0000001-0000-0000-0000-000000000002',
        tenant_id: TENANT_ID,
        patient_id: 'p2',
        drug_id: 'd1', // Same drug name Metformin
        reporter_id: 'rep2',
        reporter_type: 'patient',
        dosage: '500mg',
        onset_date: new Date(),
        narrative: 'Nausea.',
        hospitalization: false,
        life_threatening: false,
        disability: false,
        status: 'triaged',
        priority: 'medium',
        source: 'manual',
        naranjo_score: 3,
        naranjo_category: 'Possible',
        created_at: new Date(),
        updated_at: new Date()
      }
    );
  });

  describe('Express Security Hardening', () => {
    it('should inject Helmet security headers in HTTP responses', async () => {
      const res = await request(app).get('/health');
      
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(res.headers['x-dns-prefetch-control']).toBe('off');
      expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    });
  });

  describe('GET /dashboard/stats', () => {
    it('should reject dashboard stats query from reporters (403)', async () => {
      const res = await request(app)
        .get('/dashboard/stats')
        .set('Authorization', `Bearer ${REPORTER_JWT}`);

      expect(res.status).toBe(403);
    });

    it('should aggregate counts, categories, priorities, and top suspect drugs for reviewers', async () => {
      const res = await request(app)
        .get('/dashboard/stats')
        .set('Authorization', `Bearer ${REVIEWER_JWT}`);

      expect(res.status).toBe(200);
      
      const stats = res.body;
      expect(stats.casesProcessed).toBe(2);
      expect(stats.avgTimeToReview).toBe('4h'); // 4 hours difference seeded
      
      expect(stats.statusBreakdown.reviewed).toBe(1);
      expect(stats.statusBreakdown.triaged).toBe(1);
      
      expect(stats.priorityBreakdown.high).toBe(1);
      expect(stats.priorityBreakdown.medium).toBe(1);

      expect(stats.naranjoBreakdown.Probable).toBe(1);
      expect(stats.naranjoBreakdown.Possible).toBe(1);
      
      expect(stats.topSuspectDrugs.length).toBeGreaterThan(0);
    });
  });
});
