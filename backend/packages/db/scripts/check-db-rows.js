const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
const { Client } = require('pg');

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  await client.connect();
  try {
    const res = await client.query('SELECT c.id, c.status, c.priority, c.naranjo_score, c.naranjo_category, d.name as drug_name FROM cases c LEFT JOIN drugs d ON c.drug_id = d.id');
    console.log(`Total cases: ${res.rows.length}`);
    console.log(res.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

main();
