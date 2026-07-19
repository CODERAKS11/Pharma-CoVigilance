/**
 * SNOMED CT RF2 Parser & Database Loader
 * 
 * Parses the RF2 Snapshot Description file and loads clinical findings
 * and disorders into the PharmaSafe SNOMED dictionary.
 * 
 * Usage:
 *   npx tsx backend/packages/db/scripts/parse-snomed-rf2.ts --file <path-to-sct2_Description_Snapshot-en_*.txt>
 * 
 * Options:
 *   --file     Path to the sct2_Description_Snapshot-en_INT_YYYYMMDD.txt file
 *   --limit    Max concepts to import (default: all clinical findings)
 *   --output   Output JSON file path (default: backend/packages/db/scripts/snomed-parsed.json)
 *   --filter   Comma-separated semantic tags to include (default: finding,disorder)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

// ── RF2 Column Indices ──────────────────────────────────────────────
const COL = {
  ID: 0,
  EFFECTIVE_TIME: 1,
  ACTIVE: 2,
  MODULE_ID: 3,
  CONCEPT_ID: 4,
  LANGUAGE_CODE: 5,
  TYPE_ID: 6,
  TERM: 7,
  CASE_SIGNIFICANCE_ID: 8,
};

// RF2 Type IDs
const FSN_TYPE = '900000000000003001';       // Fully Specified Name
const SYNONYM_TYPE = '900000000000013009';   // Synonym / Preferred Term

// ── Types ───────────────────────────────────────────────────────────
interface ParsedConcept {
  code: string;          // SNOMED CT Concept ID
  term: string;          // Preferred term (from FSN, without semantic tag)
  synonyms: string[];    // All active synonyms
  semantic_tag: string;  // e.g. "finding", "disorder", "event"
  fsn: string;           // Full Fully Specified Name
}

// ── CLI Argument Parsing ────────────────────────────────────────────
function parseArgs() {
  const args = process.argv.slice(2);
  const config: {
    file: string;
    limit: number;
    output: string;
    filter: string[];
  } = {
    file: '',
    limit: 0,
    output: path.join(__dirname, 'snomed-parsed.json'),
    filter: ['finding', 'disorder'],
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--file':
        config.file = args[++i];
        break;
      case '--limit':
        config.limit = parseInt(args[++i], 10);
        break;
      case '--output':
        config.output = args[++i];
        break;
      case '--filter':
        config.filter = args[++i].split(',').map(s => s.trim().toLowerCase());
        break;
    }
  }

  if (!config.file) {
    console.error(`
╔══════════════════════════════════════════════════════════════════╗
║  SNOMED CT RF2 Parser for PharmaSafe                           ║
╠══════════════════════════════════════════════════════════════════╣
║                                                                ║
║  Usage:                                                        ║
║    npx tsx parse-snomed-rf2.ts --file <path-to-description>    ║
║                                                                ║
║  The file you need is inside your extracted SNOMED zip:         ║
║                                                                ║
║    Snapshot/Terminology/                                        ║
║      sct2_Description_Snapshot-en_INT_YYYYMMDD.txt             ║
║                                                                ║
║  Options:                                                      ║
║    --file     Path to the Description Snapshot file             ║
║    --limit    Max concepts to import (0 = all)                  ║
║    --output   Output JSON path (default: snomed-parsed.json)   ║
║    --filter   Semantic tags: finding,disorder,event (default)   ║
║                                                                ║
╚══════════════════════════════════════════════════════════════════╝
`);
    process.exit(1);
  }

  return config;
}

// ── Extract Semantic Tag from FSN ───────────────────────────────────
// FSN format: "Nausea (finding)" → tag = "finding", term = "Nausea"
function extractSemanticTag(fsn: string): { term: string; tag: string } {
  const match = fsn.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (match) {
    return { term: match[1].trim(), tag: match[2].trim().toLowerCase() };
  }
  return { term: fsn, tag: 'unknown' };
}

// ── Main Parser ─────────────────────────────────────────────────────
async function parseRF2(filePath: string): Promise<Map<string, {
  fsns: string[];
  synonyms: string[];
}>> {
  console.log(`\n📂 Reading RF2 file: ${filePath}`);
  console.log(`   File size: ${(fs.statSync(filePath).size / 1024 / 1024).toFixed(1)} MB\n`);

  const conceptMap = new Map<string, {
    fsns: string[];
    synonyms: string[];
  }>();

  const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  let lineCount = 0;
  let activeCount = 0;
  let skippedInactive = 0;
  let isHeader = true;

  for await (const line of rl) {
    if (isHeader) {
      isHeader = false;
      // Verify this is a Description file
      const headers = line.split('\t');
      if (!headers.includes('typeId') || !headers.includes('term')) {
        console.error('❌ This does not look like a SNOMED CT Description file.');
        console.error('   Expected columns: id, effectiveTime, active, moduleId, conceptId, languageCode, typeId, term');
        console.error(`   Got: ${headers.join(', ')}`);
        process.exit(1);
      }
      console.log(`   ✅ Valid RF2 Description file detected`);
      console.log(`   Columns: ${headers.join(' | ')}\n`);
      continue;
    }

    lineCount++;
    const cols = line.split('\t');

    // Skip inactive descriptions
    if (cols[COL.ACTIVE] !== '1') {
      skippedInactive++;
      continue;
    }

    // Only English descriptions
    if (cols[COL.LANGUAGE_CODE] !== 'en') continue;

    activeCount++;
    const conceptId = cols[COL.CONCEPT_ID];
    const typeId = cols[COL.TYPE_ID];
    const term = cols[COL.TERM];

    if (!conceptMap.has(conceptId)) {
      conceptMap.set(conceptId, { fsns: [], synonyms: [] });
    }

    const entry = conceptMap.get(conceptId)!;

    if (typeId === FSN_TYPE) {
      entry.fsns.push(term);
    } else if (typeId === SYNONYM_TYPE) {
      entry.synonyms.push(term);
    }

    // Progress indicator every 100K lines
    if (lineCount % 100000 === 0) {
      process.stdout.write(`\r   📊 Processed ${(lineCount / 1000).toFixed(0)}K lines, ${conceptMap.size} unique concepts...`);
    }
  }

  console.log(`\r   📊 Processed ${lineCount.toLocaleString()} total lines`);
  console.log(`   ✅ ${activeCount.toLocaleString()} active English descriptions`);
  console.log(`   ⏭️  ${skippedInactive.toLocaleString()} inactive descriptions skipped`);
  console.log(`   🧬 ${conceptMap.size.toLocaleString()} unique concepts found\n`);

  return conceptMap;
}

// ── Build Structured Dictionary ─────────────────────────────────────
function buildDictionary(
  conceptMap: Map<string, { fsns: string[]; synonyms: string[] }>,
  allowedTags: string[],
  limit: number
): ParsedConcept[] {
  const dictionary: ParsedConcept[] = [];

  for (const [conceptId, data] of conceptMap) {
    // Use first FSN to determine semantic tag
    const fsn = data.fsns[0];
    if (!fsn) continue;

    const { term, tag } = extractSemanticTag(fsn);

    // Filter by allowed semantic tags
    if (!allowedTags.includes(tag)) continue;

    // Collect unique synonyms (excluding the preferred term itself)
    const synonyms = [...new Set(
      data.synonyms.filter(s => s.toLowerCase() !== term.toLowerCase())
    )];

    dictionary.push({
      code: conceptId,
      term,
      synonyms,
      semantic_tag: tag,
      fsn,
    });

    if (limit > 0 && dictionary.length >= limit) break;
  }

  // Sort by term alphabetically for consistency
  dictionary.sort((a, b) => a.term.localeCompare(b.term));

  return dictionary;
}

// ── Generate TypeScript Dictionary Export ────────────────────────────
function generateTypeScriptOutput(dictionary: ParsedConcept[], outputPath: string): string {
  const tsPath = outputPath.replace(/\.json$/, '.ts');
  
  const entries = dictionary.map(d => {
    const synonymsStr = d.synonyms.slice(0, 5).map(s => `'${s.replace(/'/g, "\\'")}'`).join(', ');
    return `  { code: '${d.code}', term: '${d.term.replace(/'/g, "\\'")}', synonyms: [${synonymsStr}], semantic_tag: '${d.semantic_tag}' },`;
  }).join('\n');

  return `// Auto-generated from SNOMED CT RF2 Release
// Total concepts: ${dictionary.length}
// Semantic tags: finding, disorder
// Generated: ${new Date().toISOString()}

import { SnomedRecord } from './seed-snomed';

export const SNOMED_RF2_DICTIONARY: SnomedRecord[] = [
${entries}
];
`;
}

// ── Main ────────────────────────────────────────────────────────────
async function main() {
  const config = parseArgs();

  // Verify file exists
  if (!fs.existsSync(config.file)) {
    console.error(`❌ File not found: ${config.file}`);
    console.error(`\n   Make sure you've extracted the SNOMED CT zip and provided the correct path.`);
    console.error(`   Look for: Snapshot/Terminology/sct2_Description_Snapshot-en_INT_YYYYMMDD.txt`);
    process.exit(1);
  }

  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  SNOMED CT RF2 → PharmaSafe Dictionary Importer            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`\n   Semantic tag filter: ${config.filter.join(', ')}`);
  console.log(`   Concept limit: ${config.limit || 'unlimited'}`);

  // Step 1: Parse the RF2 file
  const conceptMap = await parseRF2(config.file);

  // Step 2: Build filtered dictionary
  console.log('🔧 Building structured dictionary...');
  const dictionary = buildDictionary(conceptMap, config.filter, config.limit);
  console.log(`   ✅ ${dictionary.length.toLocaleString()} concepts matched filters\n`);

  // Step 3: Write JSON output
  console.log(`💾 Writing JSON output: ${config.output}`);
  fs.writeFileSync(config.output, JSON.stringify(dictionary, null, 2), 'utf-8');
  const jsonSize = (fs.statSync(config.output).size / 1024 / 1024).toFixed(2);
  console.log(`   ✅ Saved (${jsonSize} MB)\n`);

  // Step 4: Generate TypeScript dictionary file
  const tsOutput = config.output.replace(/\.json$/, '-dictionary.ts');
  console.log(`📝 Generating TypeScript dictionary: ${tsOutput}`);
  const tsContent = generateTypeScriptOutput(dictionary, config.output);
  fs.writeFileSync(tsOutput, tsContent, 'utf-8');
  console.log(`   ✅ Generated\n`);

  // Step 5: Summary statistics
  const tagCounts: Record<string, number> = {};
  for (const d of dictionary) {
    tagCounts[d.semantic_tag] = (tagCounts[d.semantic_tag] || 0) + 1;
  }

  console.log('📊 Summary:');
  console.log('   ┌─────────────────┬──────────┐');
  console.log('   │ Semantic Tag    │ Count    │');
  console.log('   ├─────────────────┼──────────┤');
  for (const [tag, count] of Object.entries(tagCounts).sort((a, b) => b[1] - a[1])) {
    console.log(`   │ ${tag.padEnd(15)} │ ${count.toLocaleString().padStart(8)} │`);
  }
  console.log('   └─────────────────┴──────────┘');

  // Show sample entries
  console.log('\n📋 Sample entries (first 5):');
  for (const d of dictionary.slice(0, 5)) {
    console.log(`   • ${d.code} | ${d.term} (${d.semantic_tag})`);
    console.log(`     Synonyms: ${d.synonyms.slice(0, 3).join(', ')}${d.synonyms.length > 3 ? '...' : ''}`);
  }

  console.log(`\n✅ Done! To use in PharmaSafe, update seed-snomed.ts to import from the generated dictionary file.`);
  console.log(`\n   Next steps:`);
  console.log(`   1. Review the generated file: ${tsOutput}`);
  console.log(`   2. Update snomed.ts to import SNOMED_RF2_DICTIONARY`);
  console.log(`   3. Or merge entries into the existing SNOMED_DICTIONARY`);
}

main().catch(err => {
  console.error('❌ Fatal error:', err.message);
  process.exit(1);
});
