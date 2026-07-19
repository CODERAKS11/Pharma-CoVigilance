import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import ws from 'ws';
import { MockSupabaseQueryBuilder, mockRpc } from './mockDb';

// Provide native WebSocket support for Node.js 20 runtime (Supabase client requirement)
if (typeof globalThis.WebSocket === 'undefined') {
  (globalThis as any).WebSocket = ws;
}

dotenv.config({ path: path.join(__dirname, '../../../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseConfigured = 
  process.env.NODE_ENV !== 'test' &&
  supabaseUrl && 
  supabaseAnonKey && 
  supabaseServiceKey && 
  supabaseUrl !== 'mock' &&
  !supabaseUrl.startsWith('http://localhost'); // Force mock if localhost and not explicitly running local supabase emulator

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
export const mockSupabaseService = {
  from: (table: string) => new MockSupabaseQueryBuilder(table),
  rpc: (functionName: string, params: any) => mockRpc(functionName, params)
};

// Exported service client (switches based on configuration status)
export const supabaseService: any = isSupabaseConfigured ? realSupabaseService : mockSupabaseService;

// Function to build request-scoped clients
export function createRequestClient(token: string, userContext?: { id: string; role: any; tenantId: string }) {
  if (isSupabaseConfigured) {
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
  } else {
    // Return a mock scoped client that encapsulates user context for simulating RLS
    return {
      from: (table: string) => new MockSupabaseQueryBuilder(table, userContext),
      rpc: (functionName: string, params: any) => mockRpc(functionName, params, userContext)
    };
  }
}
