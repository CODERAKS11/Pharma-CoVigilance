const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../../.env') });

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const { InferenceClient } = require('@huggingface/inference');

const supabaseService = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false }, realtime: { transport: ws } }
);

const hfClient = new InferenceClient(process.env.HF_TOKEN);
const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

async function generateEmbedding(text) {
  const result = await hfClient.featureExtraction({
    model: 'BAAI/bge-m3',
    provider: 'hf-inference',
    inputs: text
  });
  return Array.isArray(result[0]) ? result[0] : result;
}

async function upsertCase(caseId, vector, payload) {
  const res = await fetch(`${QDRANT_URL}/collections/cases/points?wait=true`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'api-key': QDRANT_API_KEY
    },
    body: JSON.stringify({
      points: [
        {
          id: caseId,
          vector,
          payload: {
            ...payload,
            drugName: payload.drugName.toUpperCase()
          }
        }
      ]
    })
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to upsert case ${caseId}: ${txt}`);
  }
}

async function main() {
  try {
    console.log('Fetching all cases from Supabase...');
    const { data: cases, error } = await supabaseService
      .from('cases')
      .select('*, drug:drugs(name)');

    if (error) throw error;
    console.log(`Found ${cases.length} cases to re-index.`);

    for (const c of cases) {
      console.log(`Generating embedding for case ${c.id.substring(0, 8)}...`);
      const narrative = c.narrative || 'Sample narrative';
      const drugName = (c.drug?.name || 'UNKNOWN').toUpperCase();
      const embedding = await generateEmbedding(narrative);

      await upsertCase(c.id, embedding, {
        tenantId: c.tenant_id,
        drugName,
        narrative
      });
      console.log(`Successfully indexed case ${c.id.substring(0, 8)} into Qdrant!`);
    }
    console.log('All cases successfully indexed into Qdrant vector database!');
  } catch (err) {
    console.error('Error during indexing:', err);
  }
}

main();
