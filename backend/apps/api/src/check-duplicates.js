const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const { createClient } = require('@supabase/supabase-js');

const ws = require('ws');

const supabaseService = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    realtime: {
      transport: ws
    }
  }
);

async function main() {
  try {
    const { data: events, error } = await supabaseService
      .from('case_events')
      .select('*')
      .eq('action', 'duplicate_checked');
      
    if (error) throw error;
    console.log(`Found ${events ? events.length : 0} duplicate check events`);
    for (const evt of (events || [])) {
      console.log(`Case ID: ${evt.case_id}, detail:`, JSON.stringify(evt.detail));
    }

    const { data: cases, error: casesErr } = await supabaseService
      .from('cases')
      .select('id, status, created_at');

    if (casesErr) throw casesErr;
    console.log(`Total cases in DB: ${cases ? cases.length : 0}`);
    for (const c of (cases || [])) {
      console.log(`Case: ${c.id}, status: ${c.status}`);
    }

    // Check Qdrant collection points
    const qdrantUrl = process.env.QDRANT_URL;
    const qdrantKey = process.env.QDRANT_API_KEY;
    const res = await fetch(`${qdrantUrl}/collections/cases`, {
      headers: { 'api-key': qdrantKey }
    });
    if (res.ok) {
      const qData = await res.json();
      console.log('Qdrant cases collection status:', JSON.stringify(qData.result));
    } else {
      console.log('Failed to fetch Qdrant collection info:', res.status);
    }
  } catch (err) {
    console.error('Error running script:', err);
  }
}

main();
