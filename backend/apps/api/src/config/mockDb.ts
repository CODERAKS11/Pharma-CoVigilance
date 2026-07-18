import { v4 as uuidv4 } from 'uuid';

export interface Tenant {
  id: string;
  name: string;
  created_at: Date;
}

export interface AppUser {
  id: string;
  tenant_id: string;
  role: 'reporter' | 'reviewer' | 'admin';
  full_name: string;
  created_at: Date;
}

export interface Drug {
  id: string;
  tenant_id?: string;
  name: string;
  generic_name?: string;
  created_at: Date;
}

export interface Patient {
  id: string;
  tenant_id: string;
  age: number | null;
  sex: 'male' | 'female' | 'other' | 'unknown';
  created_at: Date;
}

export interface Case {
  id: string;
  tenant_id: string;
  patient_id: string;
  drug_id: string;
  reporter_id: string | null;
  reporter_type: 'healthcare_professional' | 'patient' | 'caregiver' | 'manufacturer';
  dosage: string | null;
  onset_date: Date | null;
  narrative: string;
  hospitalization: boolean;
  life_threatening: boolean;
  disability: boolean;
  status: 'intake' | 'processing' | 'triaged' | 'needs_review' | 'reviewed' | 'exported' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'critical' | null;
  source: 'faers_seed' | 'manual' | 'api';
  naranjo_score?: number | null;
  naranjo_category?: string | null;
  naranjo_answers?: any[] | null;
  snomed_candidates?: any[] | null;
  ai_summary?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface CaseEvent {
  id: string;
  case_id: string;
  actor_type: 'system' | 'ai_pipeline' | 'reporter' | 'reviewer' | 'admin';
  actor_id: string | null;
  action: string;
  detail: any;
  created_at: Date;
}

// In-memory tables
export const tenantsTable: Tenant[] = [
  { id: 'de000000-0000-0000-0000-000000000001', name: 'PharmaSafe Health', created_at: new Date() }
];

export const appUsersTable: AppUser[] = [
  { id: '55555555-5555-5555-5555-555555555555', tenant_id: 'de000000-0000-0000-0000-000000000001', role: 'reporter', full_name: 'Dr. Emily Richards', created_at: new Date() },
  { id: '66666666-6666-6666-6666-666666666666', tenant_id: 'de000000-0000-0000-0000-000000000001', role: 'reviewer', full_name: 'Dr. Sarah Chen', created_at: new Date() },
  { id: '77777777-7777-7777-7777-777777777777', tenant_id: 'de000000-0000-0000-0000-000000000001', role: 'admin', full_name: 'Admin User', created_at: new Date() }
];

export const drugsTable: Drug[] = [
  { id: 'd0000001-0000-0000-0000-000000000001', tenant_id: 'de000000-0000-0000-0000-000000000001', name: 'ASPIRIN', generic_name: 'Aspirin Acetylsalicylic Acid', created_at: new Date() }
];

export const patientsTable: Patient[] = [];
export const casesTable: Case[] = [];
export const caseEventsTable: CaseEvent[] = [];

// Helper to reset database for tests
export function resetMockDb() {
  patientsTable.length = 0;
  casesTable.length = 0;
  caseEventsTable.length = 0;
  drugsTable.length = 1; // Keep default drug
}

// Fluent Interface Mock Builder
export class MockSupabaseQueryBuilder {
  private tableName: string;
  private userContext?: { id: string; role: string; tenantId: string };
  private filters: Array<(item: any) => boolean> = [];
  private orderField?: string;
  private orderAscending: boolean = true;
  private rangeFrom?: number;
  private rangeTo?: number;
  private limitCount?: number;

  constructor(tableName: string, userContext?: { id: string; role: string; tenantId: string }) {
    this.tableName = tableName;
    this.userContext = userContext;
    this.applyRLS();
  }

  private applyRLS() {
    if (!this.userContext) return; // Service role bypass

    const { id, role, tenantId } = this.userContext;

    if (this.tableName === 'cases') {
      if (role === 'reporter') {
        this.filters.push(item => item.reporter_id === id);
      } else if (role === 'reviewer' || role === 'admin') {
        this.filters.push(item => item.tenant_id === tenantId);
      }
    } else if (this.tableName === 'case_events') {
      if (role === 'reporter') {
        this.filters.push(item => {
          const associatedCase = casesTable.find(c => c.id === item.case_id);
          return associatedCase?.reporter_id === id;
        });
      } else if (role === 'reviewer' || role === 'admin') {
        this.filters.push(item => {
          const associatedCase = casesTable.find(c => c.id === item.case_id);
          return associatedCase?.tenant_id === tenantId;
        });
      }
    } else if (this.tableName === 'patients') {
      if (role === 'reporter') {
        this.filters.push(item => {
          const associatedCase = casesTable.find(c => c.patient_id === item.id);
          return associatedCase?.reporter_id === id;
        });
      } else if (role === 'reviewer' || role === 'admin') {
        this.filters.push(item => item.tenant_id === tenantId);
      }
    } else if (this.tableName === 'app_users') {
      // Direct access allowed
    }
  }

  select(columns?: string) {
    return this;
  }

  insert(data: any) {
    const list = Array.isArray(data) ? data : [data];
    const inserted: any[] = [];

    for (const item of list) {
      const record = { ...item };
      if (!record.id) record.id = uuidv4();
      record.created_at = record.created_at || new Date();
      record.updated_at = record.updated_at || new Date();

      // Check check constraints
      if (this.tableName === 'cases') {
        if (!['intake', 'processing', 'triaged', 'needs_review', 'reviewed', 'exported', 'rejected'].includes(record.status)) {
          throw new Error('Check constraint violation on cases.status');
        }
        if (record.priority && !['low', 'medium', 'high', 'critical'].includes(record.priority)) {
          throw new Error('Check constraint violation on cases.priority');
        }
      }

      // Check RLS insert constraints
      if (this.userContext) {
        if (this.tableName === 'cases') {
          if (record.reporter_id !== this.userContext.id) {
            throw new Error('RLS check constraint violation: reporter_id must match auth.uid()');
          }
        } else if (this.tableName === 'patients') {
          if (this.userContext.role !== 'reporter' && this.userContext.role !== 'admin') {
            throw new Error('RLS check constraint violation: cannot insert patient');
          }
        }
      }

      if (this.tableName === 'patients') patientsTable.push(record);
      else if (this.tableName === 'cases') casesTable.push(record);
      else if (this.tableName === 'case_events') caseEventsTable.push(record);
      else if (this.tableName === 'drugs') drugsTable.push(record);
      else if (this.tableName === 'app_users') appUsersTable.push(record);

      inserted.push(record);
    }

    return Promise.resolve({
      data: Array.isArray(data) ? inserted : inserted[0],
      error: null
    });
  }

  update(data: any) {
    return {
      eq: (field: string, val: any) => {
        // Enforce update RLS policies
        if (this.userContext && this.tableName === 'cases') {
          if (!['reviewer', 'admin'].includes(this.userContext.role)) {
            return Promise.resolve({ data: null, error: new Error('Permission denied by cases update RLS policy') });
          }
        }

        let dbTable: any[] = [];
        if (this.tableName === 'cases') dbTable = casesTable;
        else if (this.tableName === 'patients') dbTable = patientsTable;
        else if (this.tableName === 'case_events') dbTable = caseEventsTable;

        const updated: any[] = [];
        for (const item of dbTable) {
          if (item[field] === val) {
            // Apply filters first
            let matches = true;
            for (const f of this.filters) {
              if (!f(item)) matches = false;
            }
            if (matches) {
              Object.assign(item, data, { updated_at: new Date() });
              updated.push(item);
            }
          }
        }
        return Promise.resolve({ data: updated, error: null });
      }
    };
  }

  eq(field: string, val: any) {
    this.filters.push(item => item[field] === val);
    return this;
  }

  order(field: string, { ascending } = { ascending: true }) {
    this.orderField = field;
    this.orderAscending = ascending;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  single() {
    return this.execute().then(res => {
      if (res.error) return res;
      if (!res.data || res.data.length === 0) {
        return { data: null, error: { message: 'Row not found' } };
      }
      return { data: res.data[0], error: null };
    });
  }

  // Execution method that mimics promise resolution
  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }

  private async execute() {
    let sourceTable: any[] = [];
    if (this.tableName === 'cases') sourceTable = casesTable;
    else if (this.tableName === 'patients') sourceTable = patientsTable;
    else if (this.tableName === 'case_events') sourceTable = caseEventsTable;
    else if (this.tableName === 'drugs') sourceTable = drugsTable;
    else if (this.tableName === 'app_users') sourceTable = appUsersTable;
    else if (this.tableName === 'tenants') sourceTable = tenantsTable;

    // Apply filters and clone items to prevent reference sharing
    let results = sourceTable.filter(item => {
      for (const filter of this.filters) {
        if (!filter(item)) return false;
      }
      return true;
    }).map(item => ({ ...item }));

    // Sorting
    if (this.orderField) {
      results.sort((a, b) => {
        const valA = a[this.orderField!];
        const valB = b[this.orderField!];
        if (valA instanceof Date && valB instanceof Date) {
          return this.orderAscending ? valA.getTime() - valB.getTime() : valB.getTime() - valA.getTime();
        }
        if (valA < valB) return this.orderAscending ? -1 : 1;
        if (valA > valB) return this.orderAscending ? 1 : -1;
        return 0;
      });
    }

    // Pagination
    if (this.rangeFrom !== undefined && this.rangeTo !== undefined) {
      results = results.slice(this.rangeFrom, this.rangeTo + 1);
    } else if (this.limitCount !== undefined) {
      results = results.slice(0, this.limitCount);
    }

    return { data: results, error: null };
  }
}

export async function mockRpc(functionName: string, params: any, userContext?: any) {
  if (functionName === 'create_case_transaction') {
    const {
      p_patient_age,
      p_patient_sex,
      p_drug_name,
      p_dosage,
      p_onset_date,
      p_narrative,
      p_hospitalization,
      p_life_threatening,
      p_disability,
      p_reporter_type,
      p_reporter_id
    } = params;

    // Simulate RLS/Validation
    if (userContext) {
      if (p_reporter_id !== userContext.id) {
        return { data: null, error: { message: 'Reporter ID must match authenticated user' } };
      }
    }

    // Resolve tenant
    const tenantId = userContext ? userContext.tenantId : 'de000000-0000-0000-0000-000000000001';

    // 1. Resolve drug
    let drug = drugsTable.find(d => d.name.toUpperCase() === p_drug_name.toUpperCase());
    if (!drug) {
      drug = {
        id: uuidv4(),
        tenant_id: tenantId,
        name: p_drug_name.toUpperCase(),
        created_at: new Date()
      };
      drugsTable.push(drug);
    }

    // 2. Insert patient
    const patient: Patient = {
      id: uuidv4(),
      tenant_id: tenantId,
      age: p_patient_age,
      sex: p_patient_sex || 'unknown',
      created_at: new Date()
    };
    patientsTable.push(patient);

    // 3. Insert case
    const newCase: Case = {
      id: uuidv4(),
      tenant_id: tenantId,
      patient_id: patient.id,
      drug_id: drug.id,
      reporter_id: p_reporter_id,
      reporter_type: p_reporter_type,
      dosage: p_dosage || null,
      onset_date: p_onset_date ? new Date(p_onset_date) : null,
      narrative: p_narrative,
      hospitalization: !!p_hospitalization,
      life_threatening: !!p_life_threatening,
      disability: !!p_disability,
      status: 'intake',
      priority: 'medium',
      source: 'manual',
      created_at: new Date(),
      updated_at: new Date()
    };
    casesTable.push(newCase);

    // 4. Insert case event
    const newEvent: CaseEvent = {
      id: uuidv4(),
      case_id: newCase.id,
      actor_type: 'reporter',
      actor_id: p_reporter_id,
      action: 'case_created',
      detail: { source: 'manual' },
      created_at: new Date()
    };
    caseEventsTable.push(newEvent);

    return { data: newCase.id, error: null };
  }

  return { data: null, error: { message: `Unknown RPC function ${functionName}` } };
}

