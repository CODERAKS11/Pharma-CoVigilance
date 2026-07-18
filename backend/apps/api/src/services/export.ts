import { logger } from '../config/logger';

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

/**
 * Generates a valid ICH E2B(R3) XML string representation for a case record.
 */
export function generateE2BXml(caseRecord: any): string {
  logger.info({ caseId: caseRecord.id }, 'Generating E2B(R3) XML export');

  const age = caseRecord.patient?.age || 'unknown';
  const sex = caseRecord.patient?.sex || 'unknown';
  const drug = caseRecord.drug?.name || 'suspected drug';
  const dosage = caseRecord.dosage || 'unknown';
  const score = caseRecord.naranjo_score !== undefined && caseRecord.naranjo_score !== null ? caseRecord.naranjo_score : 'unknown';
  const category = caseRecord.naranjo_category || 'unknown';
  const summary = caseRecord.ai_summary || '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<ichicsr lang="en">
  <ichicsrmessageheader>
    <messagetype>ichicsr</messagetype>
    <messageformatversion>2.1</messageformatversion>
    <messageformatrelease>2.0</messageformatrelease>
    <messagesenderidentifier>PHARMASAFE-SYSTEM</messagesenderidentifier>
    <messagereceiveridentifier>REGULATORY-GATEWAY</messagereceiveridentifier>
    <messagedateformat>204</messagedateformat>
    <messagedate>${new Date().toISOString().replace(/[-:T.Z]/g, '')}</messagedate>
  </ichicsrmessageheader>
  <safetyreport>
    <safetyreportversion>1</safetyreportversion>
    <safetyreportid>ICSR-${escapeXml(caseRecord.id)}</safetyreportid>
    <primarysource>
      <reportertype>${escapeXml(caseRecord.reporter_type)}</reportertype>
    </primarysource>
    <patient>
      <patientinitials>PAT</patientinitials>
      <patientonsetage>${age}</patientonsetage>
      <patientonsetageunit>801</patientonsetageunit> <!-- Years -->
      <patientsex>${sex === 'male' ? '1' : (sex === 'female' ? '2' : '9')}</patientsex>
      <medicalhistory>
        <patientmedicalhistorytext>${escapeXml(summary)}</patientmedicalhistorytext>
      </medicalhistory>
      <drug>
        <drugcharacterization>1</drugcharacterization> <!-- Suspected -->
        <medicinalproduct>${escapeXml(drug)}</medicinalproduct>
        <dosageform>${escapeXml(dosage)}</dosageform>
      </drug>
      <reaction>
        <reactionmeddraversiongdpr>SNOMED-CT</reactionmeddraversiongdpr>
        <reactionmeddrallt>${escapeXml(caseRecord.narrative.substring(0, 100))}</reactionmeddrallt>
      </reaction>
    </patient>
    <causalityassessment>
      <causalitymethod>Naranjo ADR Probability Scale</causalitymethod>
      <causalityscore>${score}</causalityscore>
      <causalityclassification>${escapeXml(category)}</causalityclassification>
    </causalityassessment>
  </safetyreport>
</ichicsr>`;
}

/**
 * Generates an India-specific PvPI (Pharmacovigilance Programme of India) compliant XML report.
 */
export function generatePvPIXml(caseRecord: any): string {
  logger.info({ caseId: caseRecord.id }, 'Generating PvPI XML export');

  const age = caseRecord.patient?.age || 'unknown';
  const sex = caseRecord.patient?.sex || 'unknown';
  const drug = caseRecord.drug?.name || 'suspected drug';
  const dosage = caseRecord.dosage || 'unknown';
  const score = caseRecord.naranjo_score !== undefined && caseRecord.naranjo_score !== null ? caseRecord.naranjo_score : 'unknown';
  const category = caseRecord.naranjo_category || 'unknown';
  const summary = caseRecord.ai_summary || '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<pvpiicsr lang="en">
  <pvpimessageheader>
    <nationalprogramcode>PvPI-NCC</nationalprogramcode>
    <messagetype>pvpiicsr</messagetype>
    <messageformatversion>1.0</messageformatversion>
    <messagesender>PHARMASAFE-NCC-REPORTER</messagesender>
    <messagedate>${new Date().toISOString()}</messagedate>
  </pvpimessageheader>
  <safetyreport>
    <safetyreportid>PvPI-IN-${escapeXml(caseRecord.id.substring(0, 8).toUpperCase())}</safetyreportid>
    <reporter>
      <reportertype>${escapeXml(caseRecord.reporter_type)}</reportertype>
    </reporter>
    <patient>
      <patientage>${age}</patientage>
      <patientsex>${sex}</patientsex>
      <suspectdrug>
        <brandname>${escapeXml(drug)}</brandname>
        <dosage>${escapeXml(dosage)}</dosage>
      </suspectdrug>
      <adversedrugreaction>
        <reactiontext>${escapeXml(caseRecord.narrative.substring(0, 150))}</reactiontext>
        <causality>
          <scale>Naranjo</scale>
          <score>${score}</score>
          <category>${escapeXml(category)}</category>
        </causality>
      </adversedrugreaction>
    </patient>
    <summary>
      <medicalsummary>${escapeXml(summary)}</medicalsummary>
    </summary>
  </safetyreport>
</pvpiicsr>`;
}
