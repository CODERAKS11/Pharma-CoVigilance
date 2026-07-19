const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
const QDRANT_API_KEY = process.env.QDRANT_API_KEY || '';
const COLLECTION_NAME = 'snomed_findings';

const getHeaders = (h = {}) => {
  const headersObj = { ...h };
  if (QDRANT_API_KEY) {
    headersObj['api-key'] = QDRANT_API_KEY;
  }
  return headersObj;
};

async function main() {
  console.log(`Connecting to Qdrant at ${QDRANT_URL}...`);
  try {
    // Patch unnamed default vector config to on_disk = true
    console.log('Updating vector parameters...');
    const patchRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
      method: 'PATCH',
      headers: getHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({
        vectors: {
          "": {
            on_disk: true
          }
        }
      })
    });

    const patchData = await patchRes.json();
    console.log('Patch result:', patchData);

    // Confirm new configuration
    const confirmRes = await fetch(`${QDRANT_URL}/collections/${COLLECTION_NAME}`, {
      headers: getHeaders()
    });
    const confirm = await confirmRes.json();
    console.log('New configuration:', JSON.stringify(confirm.result?.config, null, 2));
  } catch (err) {
    console.error('Error modifying collection:', err);
  }
}

main();
