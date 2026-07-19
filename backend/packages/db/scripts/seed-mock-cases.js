const { Client } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../../../.env') });
const connectionString = process.env.DATABASE_URL;

const TENANT_ID = 'de000000-0000-0000-0000-000000000001';
const REPORTER_ID = '55555555-5555-5555-5555-555555555555';

const CASES_TO_SEED = [
  {
    drugName: 'Acetaminophen',
    dosage: '1000 mg',
    patientAge: 42,
    patientSex: 'female',
    hospitalization: true,
    lifeThreatening: false,
    disability: false,
    narrative: 'Patient presented to the emergency room with severe right upper quadrant abdominal pain, nausea, and jaundice. She reports taking Acetaminophen 1000mg up to four times daily over the last two weeks to manage chronic daily headaches. Lab work revealed critically elevated liver transaminases (ALT 1850 U/L, AST 1620 U/L) indicating acute liver injury. After administering IV N-acetylcysteine (NAC) treatment, her liver function tests gradually stabilized over 48 hours.'
  },
  {
    drugName: 'Ibuprofen',
    dosage: '600 mg',
    patientAge: 68,
    patientSex: 'male',
    hospitalization: true,
    lifeThreatening: false,
    disability: false,
    narrative: 'An elderly patient with baseline mild stage 2 renal insufficiency was admitted with decreased urine output and sudden-onset peripheral edema. The patient has been taking Ibuprofen 600mg three times daily for the past three weeks to manage lower back pain. Serum creatinine spiked to 3.2 mg/dL from a baseline of 1.1 mg/dL. Ibuprofen was immediately discontinued, and aggressive intravenous hydration was started, resulting in gradual recovery of renal clearance over four days.'
  },
  {
    drugName: 'Amoxicillin',
    dosage: '500 mg',
    patientAge: 29,
    patientSex: 'other',
    hospitalization: true,
    lifeThreatening: true,
    disability: false,
    narrative: 'Within 20 minutes of taking the first dose of Amoxicillin 500mg, the patient developed generalized hives, severe swelling of the lips and tongue, and difficulty breathing. Their blood pressure dropped rapidly to 80/50 mmHg. The patient was rushed to the clinic where emergency intramuscular epinephrine was administered. They were hospitalized overnight for continuous hemodynamic observation and supportive care.'
  }
];

async function seed() {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to database for case seeding...');

    for (const c of CASES_TO_SEED) {
      console.log(`Seeding case for drug: ${c.drugName}`);

      // 1. Resolve drug
      let drugId;
      const drugRes = await client.query('SELECT id FROM drugs WHERE UPPER(name) = UPPER($1) LIMIT 1', [c.drugName]);
      if (drugRes.rows.length > 0) {
        drugId = drugRes.rows[0].id;
      } else {
        const insertDrugRes = await client.query(
          'INSERT INTO drugs (tenant_id, name) VALUES ($1, $2) RETURNING id',
          [TENANT_ID, c.drugName.toUpperCase()]
        );
        drugId = insertDrugRes.rows[0].id;
      }

      // 2. Insert patient
      const patientRes = await client.query(
        'INSERT INTO patients (tenant_id, age, sex) VALUES ($1, $2, $3) RETURNING id',
        [TENANT_ID, c.patientAge, c.patientSex]
      );
      const patientId = patientRes.rows[0].id;

      // 3. Insert case
      const caseRes = await client.query(
        `INSERT INTO cases (
          tenant_id, patient_id, drug_id, reporter_id, reporter_type,
          dosage, onset_date, narrative, hospitalization, life_threatening,
          disability, status, priority, source
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
        [
          TENANT_ID, patientId, drugId, REPORTER_ID, 'healthcare_professional',
          c.dosage, c.narrative, c.hospitalization, c.lifeThreatening,
          c.disability, 'needs_review', 'medium', 'manual'
        ]
      );
      const caseId = caseRes.rows[0].id;

      // 4. Insert case event
      await client.query(
        'INSERT INTO case_events (case_id, actor_type, actor_id, action, detail) VALUES ($1, $2, $3, $4, $5)',
        [caseId, 'reporter', REPORTER_ID, 'case_created', JSON.stringify({ source: 'manual' })]
      );

      console.log(`Case seeded successfully with ID: ${caseId}`);
    }

    console.log('All mock cases seeded successfully!');
  } catch (err) {
    console.error('Error seeding cases:', err.message);
  } finally {
    await client.end();
  }
}

seed();
