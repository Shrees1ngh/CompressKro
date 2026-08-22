/**
 * CompressKro OCR Regression Test
 * ================================
 * Tests the OCR pipeline against the 10th marksheet PDF.
 * Verifies:
 * 1. OCR text is present in the generated PDF
 * 2. Key English phrases are recognized
 * 3. Hindi Unicode text is present
 * 4. Table values are individually recognizable
 * 5. No catastrophic text merging
 * 6. Text extraction returns meaningful content
 * 7. PDF structure is valid
 */

import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

// ── Test configuration ──

const REQUIRED_PHRASES = [
  // Header
  'CENTRAL BOARD OF SECONDARY EDUCATION',
  'MARKS STATEMENT CUM CERTIFICATE',
  'SECONDARY SCHOOL EXAMINATION',
  // Personal Details
  'SHREE BHAGWAN',
  '14228472',
  'GEETA DEVI',
  'NIRANJAN SINGH',
  '29-05-2005',
  'MAY TWO THOUSAND FIVE',
  // Subjects & Marks Table
  'ENGLISH LANG',
  'EIGHTY SEVEN',
  'HINDI COURSE',
  'NINETY ONE',
  'MATHEMATICS',
  'EIGHTY TWO',
  'SCIENCE',
  'EIGHTY THREE',
  'SOCIAL SCIENCE',
  // Footer & Results
  'PASS',
  'Delhi',
  '15-07-2020',
  'Controller of Examinations',
];

const REQUIRED_PARTIAL_PHRASES = [
  // These may be split across items but should exist as substrings somewhere
  'Abbreviations',
  'Absent',
  'Practical',
  'certify',
  'Roll No',
];

const REQUIRED_HINDI_PHRASES = [
  'केन्द्रीय माध्यमिक शिक्षा',
  'अंक विवरणिका',
  'जन्म तिथि',
  'माता का नाम',
  'विद्यालय',
  'शैक्षणिक',
  'उपलब्धियां',
];

const HINDI_PATTERNS = [
  /[\u0900-\u097F]{2,}/, // At least 2 consecutive Devanagari chars
];

const TABLE_VALUES = [
  '087', '091', '082', '083',
  'EIGHTY SEVEN', 'NINETY ONE', 'EIGHTY TWO', 'EIGHTY THREE',
];

const FORBIDDEN_FUSIONS = [
  'istocertify',
  'OFSECONDARY',
  'MARKSSTATEMENT',
  'CUMCERTIFICATE',
  'SECONDARYSCHOOL',
  '082EIGHTY',
  '087EIGHTY',
  '091NINETY',
  '083EIGHTY',
];

// ── Main test runner ──

async function runRegressionTest() {
  console.log('================================================================');
  console.log('         COMPRESSKRO OCR REGRESSION TEST (v2)');
  console.log('================================================================\n');

  const pdfPath = path.resolve('..', '10th marksheet.pdf');
  if (!fs.existsSync(pdfPath)) {
    // Try alternate location
    const altPath = path.resolve('..', 'ocr_10th marksheet.pdf');
    if (fs.existsSync(altPath)) {
      console.log(`[Test] Using alternate path: ${altPath}`);
    } else {
      throw new Error(`Test PDF not found at ${pdfPath} or ${altPath}`);
    }
  }

  const pdfBytes = fs.readFileSync(pdfPath);
  console.log(`[Test] Loaded test PDF: ${pdfPath} (${pdfBytes.length} bytes)\n`);

  // Launch browser
  const browser = await puppeteer.launch({
    headless: 'new',
    protocolTimeout: 0,
    timeout: 0,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--js-flags=--max-old-space-size=4096']
  });

  const page = await browser.newPage();
  await page.setCacheEnabled(false);
  page.on('console', msg => {
    const text = msg.text();
    if (!text.includes('[vite]') && !text.includes('React DevTools') && !text.includes('Vercel Web Analytics')) {
      console.log('[BROWSER]', text);
    }
  });

  console.log('[Test] Navigating to app...');
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle0' });

  const base64Input = pdfBytes.toString('base64');

  console.log('[Test] Running OCR pipeline...\n');
  const startTime = Date.now();

  const result = await page.evaluate(async (b64) => {
    const binaryString = atob(b64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const { ocrPdf } = await import('/src/features/pdf-editor/ocr/ocrPdf.ts');
    const ocrResult = await ocrPdf(bytes.buffer, ['eng', 'hin'], undefined, { debug: true });

    return {
      pdfBytes: Array.from(ocrResult.pdfBytes),
      warnings: ocrResult.warnings,
      debugInfo: ocrResult.debugInfo,
    };
  }, base64Input);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n[Test] OCR pipeline completed in ${elapsed}s\n`);

  await browser.close();

  // Save output
  const outPdfBytes = new Uint8Array(result.pdfBytes);
  const outPdfPath = path.resolve('output_ocr_marksheet.pdf');
  fs.writeFileSync(outPdfPath, outPdfBytes);
  console.log(`[Test] Saved OCR output PDF to ${outPdfPath} (${outPdfBytes.length} bytes)`);

  // Extract text from output PDF
  const doc = await pdfjsLib.getDocument({ data: outPdfBytes }).promise;
  const p = await doc.getPage(1);
  const textContent = await p.getTextContent();
  const items = textContent.items;
  const rawExtractedText = items.map(it => it.str).join(' ').replace(/\s+/g, ' ');
  const nonEmptyItems = items.filter(it => it.str && it.str.trim().length > 0);
  const tokens = rawExtractedText.split(/\s+/).filter(t => t.length > 0);

  const debug = result.debugInfo?.pages?.[0];

  // ── Report ──
  console.log('\n================================================================');
  console.log('              REGRESSION TEST REPORT');
  console.log('================================================================\n');

  // Section 1: Metrics
  const hindiTokens = tokens.filter(t => /[\u0900-\u097F]/.test(t));
  const englishTokens = tokens.filter(t => /[a-zA-Z]/.test(t));
  const regionCount = debug?.regions?.length ?? 0;

  console.log('## 1. OCR Metrics');
  console.log(`Strategy:                        ${debug?.strategy ?? 'N/A'}`);
  console.log(`Quality Score:                   ${debug?.qualityScore?.toFixed(1) ?? 'N/A'}`);
  console.log(`OCR Confidence:                  ${debug?.confidence?.toFixed(1) ?? 'N/A'}%`);
  console.log(`Baseline Words:                  ${debug?.baselineWordsCount ?? 'N/A'}`);
  console.log(`Secondary Words:                 ${debug?.secondaryWordsCount ?? 'N/A'}`);
  console.log(`Table Cell Words:                ${debug?.tableCellWordsCount ?? 'N/A'}`);
  console.log(`Total OCR Tokens:                ${(debug?.baselineWordsCount ?? 0) + (debug?.secondaryWordsCount ?? 0)}`);
  console.log(`Total Valid Tokens:              ${debug?.insertedWordsCount ?? 'N/A'}`);
  console.log(`Hindi Token Count (Extracted):   ${hindiTokens.length}`);
  console.log(`English Token Count (Extracted): ${englishTokens.length}`);
  console.log(`Duplicates Removed:              ${debug?.duplicateCandidatesRemoved ?? 'N/A'}`);
  console.log(`Unique Words Added:              ${debug?.uniqueNewWordsAdded ?? 'N/A'}`);
  console.log(`Final Inserted Words:            ${debug?.insertedWordsCount ?? 'N/A'}`);
  console.log(`Discarded/Rejected Words:        ${debug?.discardedWordsCount ?? 0}`);
  console.log(`Coverage:                        ${debug?.coveragePercent ?? 0}%`);
  console.log('');

  // Section 2: PDF Text Layer
  console.log('## 2. PDF Text Layer Quality');
  console.log(`Text Items:                      ${items.length}`);
  console.log(`Non-Empty Items:                 ${nonEmptyItems.length}`);
  console.log(`Total Characters:                ${rawExtractedText.length}`);
  console.log(`Token Count:                     ${tokens.length}`);
  console.log(`Has Hindi Unicode:               ${/[\u0900-\u097F]/.test(rawExtractedText) ? 'YES' : 'NO'}`);
  console.log('');

  // Section 3: Required Phrase Assertions
  console.log('## 3. Required Phrase Assertions');
  let passedAssertions = 0;
  let totalAssertions = 0;

  for (const phrase of REQUIRED_PHRASES) {
    totalAssertions++;
    const found = rawExtractedText.includes(phrase);
    const status = found ? 'PASS' : 'FAIL';
    console.log(`  [${status}] "${phrase}"`);
    if (found) passedAssertions++;
  }

  for (const phrase of REQUIRED_PARTIAL_PHRASES) {
    totalAssertions++;
    const found = rawExtractedText.toLowerCase().includes(phrase.toLowerCase());
    const status = found ? 'PASS' : 'FAIL';
    console.log(`  [${status}] (partial) "${phrase}"`);
    if (found) passedAssertions++;
  }

  console.log(`\n  Passed: ${passedAssertions}/${totalAssertions}\n`);

  // Section 4: Hindi Unicode & Anchor Verification
  console.log('## 4. Hindi Unicode & Anchor Verification');
  let hindiPhrasesPassed = 0;
  for (const phrase of REQUIRED_HINDI_PHRASES) {
    const found = rawExtractedText.includes(phrase);
    const status = found ? 'PASS' : 'FAIL';
    console.log(`  [${status}] "${phrase}"`);
    if (found) hindiPhrasesPassed++;
  }
  console.log(`\n  Hindi Anchors Passed: ${hindiPhrasesPassed}/${REQUIRED_HINDI_PHRASES.length}\n`);

  // Section 5: Table Values
  console.log('## 5. Table Value Recognition');
  let tableValuesPassed = 0;
  for (const val of TABLE_VALUES) {
    const found = rawExtractedText.includes(val);
    console.log(`  [${found ? 'PASS' : 'FAIL'}] "${val}"`);
    if (found) tableValuesPassed++;
  }
  console.log(`\n  Passed: ${tableValuesPassed}/${TABLE_VALUES.length}\n`);

  // Section 6: Forbidden Fusions
  console.log('## 6. Forbidden Word Fusions');
  let fusionsPassed = 0;
  for (const fusion of FORBIDDEN_FUSIONS) {
    const found = rawExtractedText.includes(fusion);
    const status = found ? 'FAIL (FUSED)' : 'PASS (NOT FUSED)';
    console.log(`  [${status}] "${fusion}"`);
    if (!found) fusionsPassed++;
  }
  console.log(`\n  Passed: ${fusionsPassed}/${FORBIDDEN_FUSIONS.length}\n`);

  // Section 7: Regions
  console.log('## 7. Detected Regions');
  if (debug?.regions) {
    for (const r of debug.regions) {
      console.log(`  - [${r.type}] PSM: ${r.psm} | Words: ${r.rawWords} | Conf: ${r.meanConf}`);
    }
  }
  console.log('');

  // Section 8: Extracted Text Sample
  console.log('## 8. Extracted Text Sample (Full):');
  console.log('----------------------------------------------------------------');
  console.log(rawExtractedText);
  console.log('----------------------------------------------------------------\n');

  // ── Final Verdict ──
  const structuralChecks = {
    'PDF has text items': items.length > 50,
    'PDF has non-empty items': nonEmptyItems.length > 30,
    'Extracted text has content': rawExtractedText.length > 500,
    'Multiple tokens exist': tokens.length > 20,
    'Hindi Unicode present': /[\u0900-\u097F]/.test(rawExtractedText),
    'Page count preserved': doc.numPages === 1,
    'No catastrophic text loss': (debug?.insertedWordsCount ?? 0) > 100,
    'Phrase pass rate > 70%': passedAssertions / totalAssertions > 0.7,
    'Hindi anchor pass rate > 70%': hindiPhrasesPassed / REQUIRED_HINDI_PHRASES.length > 0.7,
    'Table values pass rate > 50%': tableValuesPassed / TABLE_VALUES.length > 0.5,
    'No forbidden fusions': fusionsPassed === FORBIDDEN_FUSIONS.length,
  };

  console.log('## 9. Structural Checks');
  let structuralPassed = 0;
  for (const [check, passed] of Object.entries(structuralChecks)) {
    console.log(`  [${passed ? 'PASS' : 'FAIL'}] ${check}`);
    if (passed) structuralPassed++;
  }

  const totalStructural = Object.keys(structuralChecks).length;
  console.log(`\n  Structural: ${structuralPassed}/${totalStructural}`);

  doc.destroy();

  console.log('\n================================================================');
  if (structuralPassed === totalStructural && passedAssertions === totalAssertions && hindiPhrasesPassed === REQUIRED_HINDI_PHRASES.length && tableValuesPassed === TABLE_VALUES.length) {
    console.log('  ✅ REGRESSION TEST PASSED');
  } else {
    console.log('  ❌ REGRESSION TEST FAILED');
    console.log(`     Structural: ${structuralPassed}/${totalStructural}`);
    console.log(`     Phrases: ${passedAssertions}/${totalAssertions}`);
    console.log(`     Hindi Anchors: ${hindiPhrasesPassed}/${REQUIRED_HINDI_PHRASES.length}`);
    console.log(`     Table: ${tableValuesPassed}/${TABLE_VALUES.length}`);
    console.log(`     Fusions: ${fusionsPassed}/${FORBIDDEN_FUSIONS.length}`);
  }
  console.log('================================================================\n');
}

runRegressionTest().catch(err => {
  console.error('[Test FATAL ERROR]', err);
  process.exit(1);
});
