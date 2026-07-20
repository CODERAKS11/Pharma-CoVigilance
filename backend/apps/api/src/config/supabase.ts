import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import path from 'path';
import ws from 'ws';
import { MockSupabaseQueryBuilder, mockRpc } from './mockDb';

// Provide native WebSocket support for Node.js 20 runtime (Supabase client requirement)
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = ws;
}

dotenv.config({ path: path.join(__dirname, '../../../../.env') });

const isTestEnvironment = process.env.NODE_ENV === 'test';

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseServiceKey && 
  supabaseUrl !== 'mock' &&
  !supabaseUrl.includes('localhost')
);

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-secret-key-at-least-32-characters-long';
const TEST_TENANT_ID = 'de000000-0000-0000-0000-000000000001';
const TEST_USERS = [
  { id: '55555555-5555-5555-5555-555555555555', email: 'reporter@pharmasafe.io', password: 'reporter123', name: 'Dr. Emily Richards', role: 'reporter' },
  { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', email: 'reporter-b@pharmasafe.io', password: 'reporterb123', name: 'Dr. Alex Morgan', role: 'reporter' },
  { id: '66666666-6666-6666-6666-666666666666', email: 'reviewer@pharmasafe.io', password: 'reviewer123', name: 'Dr. Sarah Chen', role: 'reviewer' },
  { id: '77777777-7777-7777-7777-777777777777', email: 'admin@pharmasafe.io', password: 'admin123', name: 'Admin User', role: 'admin' }
] as const;

function createMockAuthClient() {
  return {
    async getUser(token: string) {
      try {
        const payload = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string; tenantId: string };
        return {
          data: {
            user: {
              id: payload.id,
              email: payload.email,
              user_metadata: { role: payload.role, tenantId: payload.tenantId }
            }
          },
          error: null
        };
      } catch (error: any) {
        return {
          data: { user: null },
          error
        };
      }
    },
    async signInWithPassword({ email, password }: { email: string; password: string }) {
      const user = TEST_USERS.find(candidate => candidate.email === email && candidate.password === password);

      if (!user) {
        return {
          data: { user: null, session: null },
          error: new Error('Invalid email or password')
        };
      }

      const accessToken = jwt.sign(
        { id: user.id, email: user.email, role: user.role, tenantId: TEST_TENANT_ID },
        JWT_SECRET
      );

      return {
        data: {
          user: { id: user.id, email: user.email },
          session: { access_token: accessToken }
        },
        error: null
      };
    }
  };
}

function createMockSupabaseClient(userContext?: { id: string; role: any; tenantId: string }) {
  return {
    from: (table: string) => new MockSupabaseQueryBuilder(table, userContext),
    rpc: (functionName: string, params: any) => mockRpc(functionName, params),
    auth: createMockAuthClient()
  };
}

// Real singleton service role client
export const realSupabaseService = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null;

// Mock service role client wrapper
export const mockSupabaseService = createMockSupabaseClient();

// Exported service client. Falls back to mock client when Supabase is not configured.
export const supabaseService: any = (isTestEnvironment || !isSupabaseConfigured) 
  ? mockSupabaseService 
  : realSupabaseService;

// Function to build request-scoped clients
export function createRequestClient(token: string, userContext?: { id: string; role: any; tenantId: string }) {
  if (isTestEnvironment || !isSupabaseConfigured) {
    return createMockSupabaseClient(userContext);
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`
      }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
