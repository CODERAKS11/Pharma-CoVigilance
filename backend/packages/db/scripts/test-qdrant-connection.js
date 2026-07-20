const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const QDRANT_URL = process.env.QDRANT_URL;
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;

async function main() {
  console.log('QDRANT_URL:', QDRANT_URL);
  console.log('QDRANT_API_KEY:', QDRANT_API_KEY ? `${QDRANT_API_KEY.slice(0, 10)}...` : 'undefined');
  try {
    const headers = {};
    if (QDRANT_API_KEY) {
      headers['api-key'] = QDRANT_API_KEY;
    }
    const res = await fetch(`${QDRANT_URL}/collections`, { headers });
    console.log('Status:', res.status);
    console.log('Body:', await res.text());
  } catch (err) {
    console.error('Fetch failed with error:', err);
  }
}
main();
