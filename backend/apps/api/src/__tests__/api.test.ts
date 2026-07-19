import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../app';
import { resetMockDb, casesTable, caseEventsTable, appUsersTable } from '../config/mockDb';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-secret-key-at-least-32-characters-long';
const TENANT_ID = 'de000000-0000-0000-0000-000000000001';

// Test token helpers
const reporterAToken = jwt.sign({ id: '55555555-5555-5555-5555-555555555555', role: 'reporter', tenantId: TENANT_ID, email: 'reporter@pharmasafe.io' }, JWT_SECRET);
const reporterBToken = jwt.sign({ id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', role: 'reporter', tenantId: TENANT_ID, email: 'reporter-b@pharmasafe.io' }, JWT_SECRET);
const reviewerToken = jwt.sign({ id: '66666666-6666-6666-6666-666666666666', role: 'reviewer', tenantId: TENANT_ID, email: 'reviewer@pharmasafe.io' }, JWT_SECRET);
const adminToken = jwt.sign({ id: '77777777-7777-7777-7777-777777777777', role: 'admin', tenantId: TENANT_ID, email: 'admin@pharmasafe.io' }, JWT_SECRET);

describe('PharmaSafe Phase 1 API Integration Tests', () => {
  beforeEach(() => {
    resetMockDb();
  });

  describe('Authentication and Sessions', () => {
    it('should exchange a valid session token for user details', async () => {
      const res = await request(app)
        .post('/auth/session')
        .send({ token: reporterAToken });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe('reporter');
      expect(res.body.user.tenantId).toBe(TENANT_ID);
    });

    it('should reject invalid session tokens', async () => {
      const res = await request(app)
        .post('/auth/session')
        .send({ token: 'invalid-token' });

      expect(res.status).toBe(401);
    });

    it('should return user details via GET /auth/me', async () => {
      const res = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${reporterAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toBe('55555555-5555-5555-5555-555555555555');
      expect(res.body.user.role).toBe('reporter');
    });
  });

  describe('Case Creation (POST /cases)', () => {
    const validCasePayload = {
      patientAge: 45,
      patientSex: 'male',
      drugName: 'Aspirin',
      dosage: '100mg daily',
      onsetDate: '2026-07-15',
      narrative: 'Patient experienced mild skin rash and headache.',
      hospitalization: false,
      lifeThreatening: false,
      disability: false,
      reporterType: 'healthcare_professional'
    };

    it('should allow a reporter to submit a case and write an audit event', async () => {
      const res = await request(app)
        .post('/cases')
        .set('Authorization', `Bearer ${reporterAToken}`)
        .send(validCasePayload);

      expect(res.status).toBe(201);
      expect(res.body.caseId).toBeDefined();

      // Check DB values in-memory
      expect(casesTable.length).toBe(1);
      expect(casesTable[0].narrative).toBe(validCasePayload.narrative);
      expect(casesTable[0].reporter_id).toBe('55555555-5555-5555-5555-555555555555');
      expect(casesTable[0].status).toBe('intake');

      // Check case event
      expect(caseEventsTable.length).toBe(1);
      expect(caseEventsTable[0].case_id).toBe(res.body.caseId);
      expect(caseEventsTable[0].action).toBe('case_created');
    });

    it('should reject submissions with validation errors (400)', async () => {
      const malformedPayload = { ...validCasePayload, drugName: '', patientAge: -5 };

      const res = await request(app)
        .post('/cases')
        .set('Authorization', `Bearer ${reporterAToken}`)
        .send(malformedPayload);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
      expect(res.body.details).toBeDefined();
    });

    it('should reject case submissions from reviewers (403)', async () => {
      const res = await request(app)
        .post('/cases')
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send(validCasePayload);

      expect(res.status).toBe(403);
    });
  });

  describe('Row Level Security & Scopes (GET /cases)', () => {
    let caseIdA: string;
    let caseIdB: string;

    beforeEach(async () => {
      // Seed two cases under different reporters
      const resA = await request(app)
        .post('/cases')
        .set('Authorization', `Bearer ${reporterAToken}`)
        .send({
          patientAge: 30,
          patientSex: 'female',
          drugName: 'LIPITOR',
          narrative: 'Reporter A case narrative details.',
          reporterType: 'healthcare_professional'
        });
      caseIdA = resA.body.caseId;

      const resB = await request(app)
        .post('/cases')
        .set('Authorization', `Bearer ${reporterBToken}`)
        .send({
          patientAge: 50,
          patientSex: 'male',
          drugName: 'METFORMIN',
          narrative: 'Reporter B case narrative details.',
          reporterType: 'patient'
        });
      caseIdB = resB.body.caseId;
    });

    it('should allow reporters to list only their own cases', async () => {
      const res = await request(app)
        .get('/cases')
        .set('Authorization', `Bearer ${reporterAToken}`);

      expect(res.status).toBe(200);
      expect(res.body.cases).toHaveLength(1);
      expect(res.body.cases[0].reporter_id).toBe('55555555-5555-5555-5555-555555555555');
    });

    it('should allow reviewers to list all cases in their tenant', async () => {
      const res = await request(app)
        .get('/cases')
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.cases).toHaveLength(2);
      expect(res.body.page).toBe(1);
    });

    it('should restrict reporter to only viewing their own case details', async () => {
      // Reporter A views case A (Allowed)
      const resA = await request(app)
        .get(`/cases/${caseIdA}`)
        .set('Authorization', `Bearer ${reporterAToken}`);
      expect(resA.status).toBe(200);
      expect(resA.body.id).toBe(caseIdA);

      // Reporter A views case B (Denied / 404 under RLS mock)
      const resB = await request(app)
        .get(`/cases/${caseIdB}`)
        .set('Authorization', `Bearer ${reporterAToken}`);
      expect(resB.status).toBe(404);
    });

    it('should allow reviewer to view details for any case', async () => {
      const res = await request(app)
        .get(`/cases/${caseIdB}`)
        .set('Authorization', `Bearer ${reviewerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(caseIdB);
    });
  });

  describe('Audit Trail (GET /cases/:id/audit)', () => {
    let caseId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/cases')
        .set('Authorization', `Bearer ${reporterAToken}`)
        .send({
          patientAge: 40,
          patientSex: 'other',
          drugName: 'AMOXYCILLIN',
          narrative: 'Amoxycillin rash report.',
          reporterType: 'caregiver'
        });
      caseId = res.body.caseId;
    });

    it('should retrieve audit trail events for a case', async () => {
      const res = await request(app)
        .get(`/cases/${caseId}/audit`)
        .set('Authorization', `Bearer ${reporterAToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].action).toBe('case_created');
    });

    it('should restrict audit trail viewing to authorized users', async () => {
      const res = await request(app)
        .get(`/cases/${caseId}/audit`)
        .set('Authorization', `Bearer ${reporterBToken}`);

      // Reporter B has no RLS visibility to case, so gets empty array or error
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(0);
    });
  });

  describe('Status Override (PATCH /cases/:id/status)', () => {
    let caseId: string;

    beforeEach(async () => {
      const res = await request(app)
        .post('/cases')
        .set('Authorization', `Bearer ${reporterAToken}`)
        .send({
          patientAge: 45,
          patientSex: 'male',
          drugName: 'ASPIRIN',
          narrative: 'Aspirin upset stomach.',
          reporterType: 'healthcare_professional'
        });
      caseId = res.body.caseId;
    });

    it('should allow admins to override case status and write audit logs', async () => {
      const res = await request(app)
        .patch(`/cases/${caseId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'reviewed' });

      expect(res.status).toBe(200);
      expect(res.body.previousStatus).toBe('intake');
      expect(res.body.newStatus).toBe('reviewed');

      // Verify DB case status
      expect(casesTable[0].status).toBe('reviewed');

      // Verify audit events length (should now be 2: case_created + status_overridden)
      expect(caseEventsTable.length).toBe(2);
      expect(caseEventsTable[1].action).toBe('status_overridden');
      expect(caseEventsTable[1].detail.new_status).toBe('reviewed');
    });

    it('should reject status overrides from non-admins (403)', async () => {
      const res = await request(app)
        .patch(`/cases/${caseId}/status`)
        .set('Authorization', `Bearer ${reviewerToken}`)
        .send({ status: 'reviewed' });

      expect(res.status).toBe(403);
    });
  });
});
